import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import {
  FacilityStatus,
  Prisma as PrismaNamespace,
  ReportStatus,
  ReservationMode,
  ReservationStatus,
  UserRole,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { QuantityReservationReconciliationService } from '../facilities/quantity-reservation-reconciliation.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
import { ListReportableFacilitiesDto } from './dto/list-reportable-facilities.dto';
import { ListStaffReportsDto } from './dto/list-staff-reports.dto';
import {
  MaintenanceMode,
  REPORT_CATEGORY_LABELS,
  FACILITY_ENTITY_TYPE,
  MAINTENANCE_ENTITY_TYPE,
  REPORT_AUDIT_ACTIONS,
  REPORT_ENTITY_TYPE,
  REPORT_STATUS_LABELS,
} from './reports.constants';
import { ListReportAuditDto } from './dto/list-report-audit.dto';
import {
  formatToJakartaDateString,
  TIMEZONE,
} from '../reservations/utils/reservation-time.util';
import type {
  MaintenancePeriodResponse,
  PaginatedReportsResponse,
  ReportAuditLogResponse,
  ReportResponse,
} from './reports.types';
import type { MaintenanceWindowDto } from './dto/maintenance-window.dto';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';

const reportSelect = {
  id: true,
  reportNumber: true,
  category: true,
  description: true,
  status: true,
  decisionReason: true,
  resolutionNote: true,
  acceptedById: true,
  resolvedById: true,
  acceptedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  reporter: {
    select: {
      id: true,
      name: true,
      identityNumber: true,
      email: true,
    },
  },
  acceptedBy: {
    select: { id: true, name: true, identityNumber: true, email: true },
  },
  resolvedBy: {
    select: { id: true, name: true, identityNumber: true, email: true },
  },
  processedBy: {
    select: { id: true, name: true, identityNumber: true, email: true },
  },
  facility: {
    select: {
      id: true,
      assetCode: true,
      name: true,
      status: true,
      facilityGroupId: true,
      facilityGroup: {
        select: {
          name: true,
          reservationMode: true,
        },
      },
    },
  },
  attachments: {
    select: {
      id: true,
      storageProvider: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  maintenancePeriods: {
    select: {
      id: true,
      reportId: true,
      facilityId: true,
      startAt: true,
      endAt: true,
      note: true,
    },
    orderBy: { startAt: 'asc' as const },
  },
} satisfies Prisma.FacilityReportSelect;

type ReportRecord = Prisma.FacilityReportGetPayload<{
  select: typeof reportSelect;
}>;

type MaintenanceImpact = {
  facilityId: string;
  approvedReservations: Array<{
    id: string;
    usageDate: string;
    startTime: string;
    endTime: string;
  }>;
  pendingReservations: Array<{
    id: string;
    usageDate: string;
    startTime: string;
    endTime: string;
    requestedQuantity: number;
  }>;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly reconciliation: QuantityReservationReconciliationService,
    @Optional() private readonly idempotency?: IdempotencyService,
  ) {}

  private runIdempotently<T>(
    actorId: string,
    key: string | undefined,
    payload: unknown,
    operation: () => Promise<T>,
  ) {
    if (!key?.trim() || !this.idempotency) {
      return operation();
    }
    return this.idempotency.execute(actorId, key, payload, operation);
  }

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel:
            PrismaNamespace.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 3
        ) {
          continue;
        }
        if (
          error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          throw new ConflictException(
            'Data laporan atau ketersediaan berubah karena proses lain. Silakan muat ulang lalu coba kembali.',
          );
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Perubahan laporan tidak dapat diproses. Silakan coba kembali.',
    );
  }

  private async lockReport(
    transaction: Pick<Prisma.TransactionClient, '$executeRaw'>,
    reportId: string,
  ) {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('facility-report'),
        hashtext(${reportId})
      )
    `;
  }

  async create(
    reporterId: string,
    input: CreateReportDto,
    files: Express.Multer.File[],
    idempotencyKey?: string,
  ) {
    if (files.length < 1 || files.length > 3) {
      throw new BadRequestException({
        code: 'INVALID_REPORT_PHOTO_COUNT',
        message: 'Laporan harus memiliki 1 sampai 3 foto.',
      });
    }
    const payload = {
      input,
      files: files.map((file) => ({
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        contentHash: createHash('sha256')
          .update(file.buffer ?? Buffer.alloc(0))
          .digest('hex'),
      })),
    };

    return this.runIdempotently(
      reporterId,
      idempotencyKey,
      payload,
      async () => {
        const facility = await this.prisma.facility.findUnique({
          where: { id: input.facilityId },
          select: {
            id: true,
            status: true,
          },
        });

        if (!facility) {
          throw new NotFoundException({
            code: 'FACILITY_NOT_FOUND',
            message: 'The selected facility was not found.',
          });
        }
        if (facility.status === FacilityStatus.NONACTIVE) {
          throw new ConflictException({
            code: 'FACILITY_NOT_REPORTABLE',
            message: 'A nonactive facility cannot receive a new report.',
          });
        }

        const uploaded: Awaited<
          ReturnType<ObjectStorageService['uploadReportPhoto']>
        >[] = [];
        try {
          for (const file of files) {
            uploaded.push(await this.storage.uploadReportPhoto(file));
          }

          const report = await this.prisma.$transaction(async (transaction) => {
            const created = await transaction.facilityReport.create({
              data: {
                reportNumber: this.generateReportNumber(new Date()),
                reporterId,
                facilityId: facility.id,
                category: input.category,
                description: input.description,
                status: ReportStatus.NEW,
              },
              select: reportSelect,
            });

            await transaction.auditLog.create({
              data: {
                actorId: reporterId,
                action: REPORT_AUDIT_ACTIONS.CREATED,
                entityType: REPORT_ENTITY_TYPE,
                entityId: created.id,
                metadata: {
                  facilityId: created.facility.id,
                  category: created.category,
                  status: created.status,
                },
              },
            });

            await transaction.reportAttachment.createMany({
              data: uploaded.map((attachment) => ({
                reportId: created.id,
                ...attachment,
              })),
            });

            return created;
          });

          return this.detailMine(reporterId, report.id);
        } catch (error) {
          await Promise.allSettled(
            uploaded.map((attachment) =>
              this.storage.remove(attachment.objectKey),
            ),
          );
          throw error;
        }
      },
    );
  }

  async listReportableFacilities(query: ListReportableFacilitiesDto) {
    const now = new Date();
    const skip = (query.page - 1) * query.limit;
    const groupFilter: Prisma.FacilityGroupWhereInput = {
      ...(query.facilityGroupId ? { id: query.facilityGroupId } : {}),
      ...(query.facilityAreaId ? { facilityAreaId: query.facilityAreaId } : {}),
    };
    const searchFilter: Prisma.FacilityWhereInput | undefined = query.search
      ? {
          OR: [
            { assetCode: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            {
              facilityGroup: {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  {
                    locationDetail: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          ],
        }
      : undefined;
    const where: Prisma.FacilityWhereInput = {
      status: { not: FacilityStatus.NONACTIVE },
      facilityGroup: groupFilter,
      ...(searchFilter ? { AND: [searchFilter] } : {}),
    };
    const select = {
      id: true,
      assetCode: true,
      name: true,
      status: true,
      maintenancePeriods: {
        where: { startAt: { lte: now }, endAt: { gt: now } },
        select: { id: true },
      },
      facilityGroup: {
        select: {
          id: true,
          name: true,
          reservationMode: true,
          locationDetail: true,
          facilityType: { select: { id: true, name: true } },
          facilityArea: { select: { id: true, code: true, name: true } },
        },
      },
    } satisfies Prisma.FacilitySelect;
    const [items, total] = await Promise.all([
      this.prisma.facility.findMany({
        where,
        select,
        orderBy: [{ facilityGroup: { name: 'asc' } }, { assetCode: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.facility.count({ where }),
    ]);

    return {
      items: items.map((facility) => ({
        facilityId: facility.id,
        assetCode: facility.assetCode,
        name: facility.name ?? facility.facilityGroup.name,
        facilityGroup: {
          id: facility.facilityGroup.id,
          name: facility.facilityGroup.name,
          reservationMode: facility.facilityGroup.reservationMode,
        },
        facilityType: facility.facilityGroup.facilityType,
        facilityArea: facility.facilityGroup.facilityArea,
        locationDetail: facility.facilityGroup.locationDetail,
        status:
          facility.maintenancePeriods.length > 0 ? 'MAINTENANCE' : 'ACTIVE',
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getAttachmentForViewer(
    viewer: AuthenticatedUser,
    reportId: string,
    attachmentId: string,
  ) {
    if (viewer.role !== UserRole.USER && viewer.role !== UserRole.STAFF) {
      throw new ForbiddenException({
        code: 'REPORT_ATTACHMENT_FORBIDDEN',
        message: 'Anda tidak memiliki akses ke foto laporan ini.',
      });
    }
    const attachment = await this.prisma.reportAttachment.findFirst({
      where: { id: attachmentId, reportId },
      select: {
        id: true,
        objectKey: true,
        originalFilename: true,
        report: { select: { reporterId: true } },
      },
    });
    if (
      !attachment ||
      (viewer.role === UserRole.USER &&
        attachment.report.reporterId !== viewer.id)
    ) {
      throw new NotFoundException({
        code: 'REPORT_ATTACHMENT_NOT_FOUND',
        message: 'Foto laporan tidak ditemukan.',
      });
    }
    const stored = await this.storage.getReportPhoto(attachment.objectKey);
    await this.prisma.auditLog.create({
      data: {
        actorId: viewer.id,
        action: REPORT_AUDIT_ACTIONS.ATTACHMENT_DOWNLOADED,
        entityType: REPORT_ENTITY_TYPE,
        entityId: reportId,
        metadata: { attachmentId },
      },
    });
    return {
      ...stored,
      originalFilename: attachment.originalFilename,
    };
  }

  async listStaff(
    query: ListStaffReportsDto,
  ): Promise<PaginatedReportsResponse> {
    const where: Prisma.FacilityReportWhereInput = {
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.facilityId === undefined
        ? {}
        : { facilityId: query.facilityId }),
      ...(query.createdFrom === undefined && query.createdTo === undefined
        ? {}
        : {
            createdAt: {
              ...(query.createdFrom === undefined
                ? {}
                : { gte: new Date(query.createdFrom) }),
              ...(query.createdTo === undefined
                ? {}
                : { lte: new Date(query.createdTo) }),
            },
          }),
      ...(query.search === undefined
        ? {}
        : {
            OR: [
              { reportNumber: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              {
                facility: {
                  is: {
                    OR: [
                      { assetCode: { contains: query.search, mode: 'insensitive' } },
                      { name: { contains: query.search, mode: 'insensitive' } },
                      {
                        facilityGroup: {
                          name: { contains: query.search, mode: 'insensitive' },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }),
    };
    const skip = (query.page - 1) * query.limit;
    const [reports, total] = await Promise.all([
      this.prisma.facilityReport.findMany({
        where,
        select: reportSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.facilityReport.count({ where }),
    ]);

    return {
      items: reports.map((report) => this.toResponse(report)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async listMine(
    reporterId: string,
    query: ListMyReportsDto,
  ): Promise<PaginatedReportsResponse> {
    const where: Prisma.FacilityReportWhereInput = {
      reporterId,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.facilityId === undefined
        ? {}
        : { facilityId: query.facilityId }),
      ...(query.createdFrom === undefined && query.createdTo === undefined
        ? {}
        : {
            createdAt: {
              ...(query.createdFrom === undefined
                ? {}
                : { gte: new Date(query.createdFrom) }),
              ...(query.createdTo === undefined
                ? {}
                : { lte: new Date(query.createdTo) }),
            },
          }),
    };
    const skip = (query.page - 1) * query.limit;
    const [reports, total] = await Promise.all([
      this.prisma.facilityReport.findMany({
        where,
        select: reportSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.facilityReport.count({ where }),
    ]);

    return {
      items: reports.map((report) => this.toResponse(report)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async detailMine(reporterId: string, reportId: string) {
    const report = await this.prisma.facilityReport.findFirst({
      where: { id: reportId, reporterId },
      select: reportSelect,
    });
    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'The report was not found.',
      });
    }
    return this.toResponse(report);
  }

  async detailStaff(reportId: string) {
    const report = await this.prisma.facilityReport.findUnique({
      where: { id: reportId },
      select: reportSelect,
    });
    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'The report was not found.',
      });
    }
    return this.toResponse(report);
  }

  async listAudit(
    reportId: string,
    query: ListReportAuditDto,
  ): Promise<{
    items: ReportAuditLogResponse[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const report = await this.prisma.facilityReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        facilityId: true,
        maintenancePeriods: { select: { id: true } },
      },
    });

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'The report was not found.',
      });
    }

    const maintenanceIds = report.maintenancePeriods.map((period) => period.id);
    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { entityType: REPORT_ENTITY_TYPE, entityId: reportId },
        ...(maintenanceIds.length > 0
          ? [
              {
                entityType: MAINTENANCE_ENTITY_TYPE,
                entityId: { in: maintenanceIds },
              },
            ]
          : []),
        { entityType: FACILITY_ENTITY_TYPE, entityId: report.facilityId },
      ],
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: logs.map((log) => ({
        ...log,
        metadata: log.metadata ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async accept(staffId: string, reportId: string): Promise<ReportResponse> {
    return this.runSerializableTransaction(async (tx) => {
      await this.lockReport(tx, reportId);
      const report = await tx.facilityReport.findUnique({
        where: { id: reportId },
        select: reportSelect,
      });

      if (!report) {
        throw new NotFoundException({
          code: 'REPORT_NOT_FOUND',
          message: 'The report was not found.',
        });
      }
      if (report.status === ReportStatus.IN_PROGRESS) {
        return this.toResponse(report);
      }
      if (report.status !== ReportStatus.NEW) {
        throw new ConflictException({
          code: 'REPORT_INVALID_TRANSITION',
          message: 'This report is no longer actionable.',
        });
      }

      const now = new Date();
      const changed = await tx.facilityReport.updateMany({
        where: { id: reportId, status: ReportStatus.NEW },
        data: {
          status: ReportStatus.IN_PROGRESS,
          acceptedById: staffId,
          acceptedAt: now,
          processedById: staffId,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException({
          code: 'REPORT_ALREADY_ACCEPTED',
          message: 'Laporan sudah diterima oleh petugas lain.',
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: REPORT_AUDIT_ACTIONS.ACCEPTED,
          entityType: REPORT_ENTITY_TYPE,
          entityId: reportId,
          metadata: {
            fromStatus: ReportStatus.NEW,
            toStatus: ReportStatus.IN_PROGRESS,
            acceptedById: staffId,
            acceptedAt: now.toISOString(),
            processedById: staffId,
          },
        },
      });

      const updated = await tx.facilityReport.findUnique({
        where: { id: reportId },
        select: reportSelect,
      });
      if (!updated) {
        throw new NotFoundException({
          code: 'REPORT_NOT_FOUND',
          message: 'The report was not found after acceptance.',
        });
      }
      return this.toResponse(updated);
    });
  }

  async reject(
    staffId: string,
    reportId: string,
    reason: string,
  ): Promise<ReportResponse> {
    if (!reason || !reason.trim()) {
      throw new ConflictException({
        code: 'REPORT_REJECTION_REASON_REQUIRED',
        message: 'A rejection reason is required.',
      });
    }

    return this.runSerializableTransaction(async (tx) => {
      await this.lockReport(tx, reportId);
      const report = await tx.facilityReport.findUnique({
        where: { id: reportId },
        select: reportSelect,
      });
      if (!report) {
        throw new NotFoundException({
          code: 'REPORT_NOT_FOUND',
          message: 'The report was not found.',
        });
      }
      if (
        report.status !== ReportStatus.NEW &&
        report.status !== ReportStatus.IN_PROGRESS
      ) {
        throw new ConflictException({
          code: 'REPORT_INVALID_TRANSITION',
          message: 'A rejected or resolved report cannot be rejected again.',
        });
      }

      const maintenance = await tx.maintenancePeriod.findFirst({
        where: { reportId, endAt: { gt: new Date() } },
        select: { id: true },
      });
      if (maintenance) {
        throw new ConflictException({
          code: 'REPORT_MAINTENANCE_STILL_ACTIVE_OR_SCHEDULED',
          message:
            'This report cannot be rejected while maintenance is active or scheduled.',
        });
      }

      const now = new Date();
      const changed = await tx.facilityReport.updateMany({
        where: {
          id: reportId,
          status: { in: [ReportStatus.NEW, ReportStatus.IN_PROGRESS] },
        },
        data: {
          status: ReportStatus.REJECTED,
          decisionReason: reason.trim(),
          processedById: staffId,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException({
          code: 'REPORT_INVALID_TRANSITION',
          message: 'Laporan sudah diproses oleh petugas lain.',
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: REPORT_AUDIT_ACTIONS.REJECTED,
          entityType: REPORT_ENTITY_TYPE,
          entityId: reportId,
          metadata: {
            fromStatus: report.status,
            toStatus: ReportStatus.REJECTED,
            decisionReason: reason.trim(),
            processedById: staffId,
            decidedAt: now.toISOString(),
          },
        },
      });

      const updated = await tx.facilityReport.findUnique({
        where: { id: reportId },
        select: reportSelect,
      });
      if (!updated) {
        throw new NotFoundException({
          code: 'REPORT_NOT_FOUND',
          message: 'The report was not found after rejection.',
        });
      }
      return this.toResponse(updated);
    });
  }

  async resolve(
    staffId: string,
    reportId: string,
    resolutionNote: string,
  ): Promise<ReportResponse> {
    if (!resolutionNote || !resolutionNote.trim()) {
      throw new ConflictException({
        code: 'REPORT_RESOLUTION_NOTE_REQUIRED',
        message: 'A resolution note is required.',
      });
    }

    return this.runSerializableTransaction(async (tx) => {
      await this.lockReport(tx, reportId);
      const report = await tx.facilityReport.findUnique({
        where: { id: reportId },
        select: reportSelect,
      });
      if (!report) {
        throw new NotFoundException({
          code: 'REPORT_NOT_FOUND',
          message: 'The report was not found.',
        });
      }
      if (report.status !== ReportStatus.IN_PROGRESS) {
        throw new ConflictException({
          code: 'REPORT_INVALID_TRANSITION',
          message: 'Only a report in progress can be resolved.',
        });
      }

      const scheduledMaintenance = await tx.maintenancePeriod.findFirst({
        where: { reportId, endAt: { gt: new Date() } },
        select: { id: true },
      });
      if (scheduledMaintenance) {
        throw new ConflictException({
          code: 'REPORT_MAINTENANCE_STILL_ACTIVE_OR_SCHEDULED',
          message:
            'This report cannot be resolved while maintenance is active or scheduled.',
        });
      }

      const now = new Date();
      const changed = await tx.facilityReport.updateMany({
        where: { id: reportId, status: ReportStatus.IN_PROGRESS },
        data: {
          status: ReportStatus.RESOLVED,
          resolutionNote: resolutionNote.trim(),
          resolvedById: staffId,
          resolvedAt: now,
          processedById: staffId,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException({
          code: 'REPORT_INVALID_TRANSITION',
          message: 'Laporan sudah diproses oleh petugas lain.',
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: REPORT_AUDIT_ACTIONS.RESOLVED,
          entityType: REPORT_ENTITY_TYPE,
          entityId: reportId,
          metadata: {
            fromStatus: report.status,
            toStatus: ReportStatus.RESOLVED,
            resolutionNote: resolutionNote.trim(),
            resolvedById: staffId,
            resolvedAt: now.toISOString(),
            processedById: staffId,
          },
        },
      });

      const updated = await tx.facilityReport.findUnique({
        where: { id: reportId },
        select: reportSelect,
      });
      if (!updated) {
        throw new NotFoundException({
          code: 'REPORT_NOT_FOUND',
          message: 'The report was not found after resolution.',
        });
      }
      return this.toResponse(updated);
    });
  }

  private maintenanceDates(input: MaintenanceWindowDto) {
    const dateStart =
      input.mode === MaintenanceMode.DATE_RANGE
        ? new Date(`${input.startDate ?? ''}T07:00:00.000+07:00`)
        : new Date(`${input.date ?? ''}T${input.startTime ?? ''}:00.000+07:00`);
    const dateEnd =
      input.mode === MaintenanceMode.DATE_RANGE
        ? new Date(`${input.endDate ?? ''}T20:00:00.000+07:00`)
        : new Date(`${input.date ?? ''}T${input.endTime ?? ''}:00.000+07:00`);

    if (Number.isNaN(dateStart.getTime()) || Number.isNaN(dateEnd.getTime())) {
      throw new ConflictException({
        code: 'MAINTENANCE_INVALID_RANGE',
        message: 'Maintenance dates and times are incomplete or invalid.',
      });
    }

    if (dateEnd <= dateStart) {
      throw new ConflictException({
        code: 'MAINTENANCE_INVALID_RANGE',
        message: 'Maintenance end time must be after start time.',
      });
    }

    if (dateStart < new Date()) {
      throw new ConflictException({
        code: 'MAINTENANCE_PERIOD_IN_PAST',
        message: 'Maintenance must start now or be scheduled for the future.',
      });
    }

    return { dateStart, dateEnd };
  }

  async previewReportMaintenanceImpact(
    reportId: string,
    input: MaintenanceWindowDto,
  ) {
    const { dateStart, dateEnd } = this.maintenanceDates(input);
    return this.prisma.$transaction(async (tx) => {
      await this.lockReport(tx, reportId);
      const report = await tx.facilityReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          status: true,
          facilityId: true,
          facility: {
            select: {
              status: true,
              facilityGroupId: true,
              facilityGroup: { select: { reservationMode: true } },
            },
          },
        },
      });
      if (!report) {
        throw new NotFoundException({
          code: 'REPORT_NOT_FOUND',
          message: 'The report was not found.',
        });
      }
      if (report.status !== ReportStatus.IN_PROGRESS) {
        throw new ConflictException({
          code: 'REPORT_NOT_IN_PROGRESS',
          message: 'Only IN_PROGRESS reports can create maintenance periods.',
        });
      }
      if (report.facility.status === FacilityStatus.NONACTIVE) {
        throw new ConflictException({
          code: 'FACILITY_NOT_ACTIVE',
          message: 'Maintenance cannot be scheduled for a nonactive facility.',
        });
      }

      const scope =
        report.facility.facilityGroup.reservationMode ===
        ReservationMode.QUANTITY
          ? 'FACILITY_GROUP'
          : 'FACILITY';
      const scopeId =
        scope === 'FACILITY_GROUP'
          ? report.facility.facilityGroupId
          : report.facilityId;
      await this.reconciliation.lockAvailabilityWindow(
        tx,
        scope,
        scopeId,
        dateStart,
        dateEnd,
      );

      return {
        reportId,
        ...(await this.getMaintenanceImpact(
          report.facilityId,
          dateStart,
          dateEnd,
          tx,
        )),
      };
    });
  }

  async confirmMaintenancePeriod(
    staffId: string,
    reportId: string,
    input: MaintenanceWindowDto & {
      cancelImpactedReservations: boolean;
      cancellationReason?: string;
      note?: string;
    },
    idempotencyKey?: string,
  ) {
    if (!input.cancelImpactedReservations) {
      throw new ConflictException({
        code: 'MAINTENANCE_CONFIRMATION_REQUIRED',
        message:
          'Maintenance impact must be confirmed before the period is created.',
      });
    }
    if (!input.cancellationReason?.trim()) {
      throw new ConflictException({
        code: 'MAINTENANCE_REASON_REQUIRED',
        message: 'A cancellation reason is required for impacted reservations.',
      });
    }

    const { dateStart, dateEnd } = this.maintenanceDates(input);
    const reason = input.cancellationReason.trim();

    return this.runIdempotently(
      staffId,
      idempotencyKey,
      { reportId, input },
      () =>
        this.runSerializableTransaction(async (tx) => {
          await this.lockReport(tx, reportId);
          const report = await tx.facilityReport.findUnique({
            where: { id: reportId },
            select: {
              id: true,
              status: true,
              facilityId: true,
              facility: {
                select: {
                  status: true,
                  facilityGroupId: true,
                  facilityGroup: { select: { reservationMode: true } },
                },
              },
            },
          });
          if (!report) {
            throw new NotFoundException({
              code: 'REPORT_NOT_FOUND',
              message: 'The report was not found.',
            });
          }
          if (report.status !== ReportStatus.IN_PROGRESS) {
            throw new ConflictException({
              code: 'REPORT_NOT_IN_PROGRESS',
              message:
                'Only IN_PROGRESS reports can create maintenance periods.',
            });
          }
          if (report.facility.status === FacilityStatus.NONACTIVE) {
            throw new ConflictException({
              code: 'FACILITY_NOT_ACTIVE',
              message:
                'Maintenance cannot be created for a nonactive facility.',
            });
          }

          const isQuantity =
            report.facility.facilityGroup.reservationMode ===
            ReservationMode.QUANTITY;
          const scope = isQuantity ? 'FACILITY_GROUP' : 'FACILITY';
          const scopeId = isQuantity
            ? report.facility.facilityGroupId
            : report.facilityId;
          await this.reconciliation.lockAvailabilityWindow(
            tx,
            scope,
            scopeId,
            dateStart,
            dateEnd,
          );

          const impact = await this.getMaintenanceImpact(
            report.facilityId,
            dateStart,
            dateEnd,
            tx,
          );
          const now = new Date();
          const approvedIds = impact.approvedReservations.map(
            (reservation) => reservation.id,
          );
          const pendingIds = impact.pendingReservations.map(
            (reservation) => reservation.id,
          );

          await tx.auditLog.create({
            data: {
              actorId: staffId,
              action: REPORT_AUDIT_ACTIONS.MAINTENANCE_IMPACT_CONFIRMED,
              entityType: REPORT_ENTITY_TYPE,
              entityId: reportId,
              metadata: {
                facilityId: report.facilityId,
                startAt: dateStart.toISOString(),
                endAt: dateEnd.toISOString(),
                approvedImpactCount: approvedIds.length,
                pendingImpactCount: pendingIds.length,
                reason,
              },
            },
          });

          let approvedCancelled = 0;
          for (const reservationId of approvedIds) {
            const changed = await tx.reservation.updateMany({
              where: { id: reservationId, status: ReservationStatus.APPROVED },
              data: {
                status: ReservationStatus.CANCELLED_BY_STAFF,
                decisionReason: reason,
                processedById: staffId,
                cancelledAt: now,
              },
            });
            if (changed.count !== 1) {
              continue;
            }
            approvedCancelled++;
            await tx.auditLog.create({
              data: {
                actorId: staffId,
                action: 'RESERVATION_CANCELLED_BY_STAFF',
                entityType: 'RESERVATION',
                entityId: reservationId,
                metadata: {
                  reason,
                  cancellationSource: 'MAINTENANCE_PERIOD',
                  reportId,
                  facilityId: report.facilityId,
                },
              },
            });
          }

          let pendingRejected = 0;
          if (isQuantity) {
            const pendingDates = await tx.reservation.findMany({
              where: {
                facilityGroupId: report.facility.facilityGroupId,
                status: ReservationStatus.PENDING,
                usageDate: {
                  gte: this.usageDateStartUtc(dateStart),
                  lte: this.usageDateStartUtc(dateEnd),
                },
              },
              select: { usageDate: true },
              distinct: ['usageDate'],
            });
            for (const pendingDate of pendingDates) {
              const result =
                await this.reconciliation.rejectInfeasibleQuantityReservations(
                  tx,
                  {
                    facilityGroupId: report.facility.facilityGroupId,
                    usageDate: pendingDate.usageDate,
                    additionalMaintenance: {
                      facilityId: report.facilityId,
                      startAt: dateStart,
                      endAt: dateEnd,
                    },
                    actorId: staffId,
                    processedById: staffId,
                    decidedAt: now,
                    reason,
                    metadata: {
                      reportId,
                      facilityId: report.facilityId,
                      rejectionSource: 'MAINTENANCE_PERIOD',
                    },
                  },
                );
              pendingRejected += result.rejectedReservationIds.length;
            }
          } else {
            const result =
              await this.reconciliation.rejectExclusiveReservations(tx, {
                facilityId: report.facilityId,
                startAt: dateStart,
                endAt: dateEnd,
                actorId: staffId,
                processedById: staffId,
                decidedAt: now,
                reason,
                metadata: {
                  reportId,
                  facilityId: report.facilityId,
                  rejectionSource: 'MAINTENANCE_PERIOD',
                },
              });
            pendingRejected = result.rejectedReservationIds.length;
          }

          const period = await tx.maintenancePeriod.create({
            data: {
              facilityId: report.facilityId,
              reportId,
              startAt: dateStart,
              endAt: dateEnd,
              note: input.note ?? reason,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: staffId,
              action: REPORT_AUDIT_ACTIONS.MAINTENANCE_CREATED,
              entityType: MAINTENANCE_ENTITY_TYPE,
              entityId: period.id,
              metadata: {
                reportId,
                facilityId: report.facilityId,
                startAt: dateStart.toISOString(),
                endAt: dateEnd.toISOString(),
                approvedCancellations: approvedCancelled,
                pendingRejections: pendingRejected,
                reason,
              },
            },
          });

          return {
            id: period.id,
            reportId: period.reportId,
            facilityId: period.facilityId,
            startAt: period.startAt.toISOString(),
            endAt: period.endAt.toISOString(),
            note: period.note,
            approvedCancelled,
            pendingRejected,
          };
        }),
    );
  }

  async endMaintenancePeriod(staffId: string, periodId: string, endAt: Date) {
    const updated = await this.runSerializableTransaction(async (tx) => {
      const maintenance = await tx.maintenancePeriod.findUnique({
        where: { id: periodId },
        include: {
          facility: {
            select: {
              facilityGroupId: true,
              facilityGroup: { select: { reservationMode: true } },
            },
          },
        },
      });
      if (!maintenance) {
        throw new NotFoundException({
          code: 'MAINTENANCE_PERIOD_NOT_FOUND',
          message: 'The maintenance period was not found.',
        });
      }
      if (
        endAt <= maintenance.startAt ||
        maintenance.endAt <= endAt ||
        maintenance.startAt > new Date()
      ) {
        throw new ConflictException({
          code: 'MAINTENANCE_INVALID_OVERRIDE',
          message:
            'Only an active maintenance period can be ended before its scheduled end time.',
        });
      }

      const isQuantity =
        maintenance.facility.facilityGroup.reservationMode ===
        ReservationMode.QUANTITY;
      await this.reconciliation.lockAvailabilityWindow(
        tx,
        isQuantity ? 'FACILITY_GROUP' : 'FACILITY',
        isQuantity
          ? maintenance.facility.facilityGroupId
          : maintenance.facilityId,
        maintenance.startAt,
        maintenance.endAt,
      );
      const changed = await tx.maintenancePeriod.updateMany({
        where: { id: periodId, endAt: { gt: endAt } },
        data: { endAt },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Periode maintenance sudah diubah oleh petugas lain.',
        );
      }

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: REPORT_AUDIT_ACTIONS.MAINTENANCE_ENDED_EARLY,
          entityType: MAINTENANCE_ENTITY_TYPE,
          entityId: periodId,
          metadata: {
            facilityId: maintenance.facilityId,
            reportId: maintenance.reportId,
            oldEndAt: maintenance.endAt.toISOString(),
            newEndAt: endAt.toISOString(),
          },
        },
      });

      return {
        ...maintenance,
        endAt,
      };
    });

    return {
      id: updated.id,
      facilityId: updated.facilityId,
      reportId: updated.reportId,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
      note: updated.note,
    };
  }

  private async getMaintenanceImpact(
    facilityId: string,
    startAt: Date,
    endAt: Date,
    client: Pick<
      Prisma.TransactionClient,
      'facility' | 'reservation' | 'maintenancePeriod'
    >,
  ): Promise<MaintenanceImpact> {
    const facility = await client.facility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        facilityGroupId: true,
        status: true,
        facilityGroup: {
          select: {
            reservationMode: true,
            facilities: {
              where: { status: { not: FacilityStatus.NONACTIVE } },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!facility) {
      throw new NotFoundException({
        code: 'FACILITY_NOT_FOUND',
        message: 'The facility was not found.',
      });
    }

    if (facility.status === FacilityStatus.NONACTIVE) {
      throw new ConflictException({
        code: 'FACILITY_NOT_ACTIVE',
        message: 'Maintenance cannot be scheduled for a nonactive facility.',
      });
    }

    const usageDate = {
      gte: this.usageDateStartUtc(startAt),
      lte: this.usageDateStartUtc(endAt),
    };
    const isQuantity =
      facility.facilityGroup.reservationMode === ReservationMode.QUANTITY;
    const approvedWhere: Prisma.ReservationWhereInput = isQuantity
      ? {
          facilityGroupId: facility.facilityGroupId,
          items: { some: { facilityId } },
          status: ReservationStatus.APPROVED,
          usageDate,
        }
      : { facilityId, status: ReservationStatus.APPROVED, usageDate };
    const pendingWhere: Prisma.ReservationWhereInput = isQuantity
      ? {
          facilityGroupId: facility.facilityGroupId,
          status: ReservationStatus.PENDING,
          usageDate,
        }
      : { facilityId, status: ReservationStatus.PENDING, usageDate };
    const reservationSelect = {
      id: true,
      usageDate: true,
      startTime: true,
      endTime: true,
      requestedQuantity: true,
    } satisfies Prisma.ReservationSelect;
    const [approved, pending] = await Promise.all([
      client.reservation.findMany({
        where: approvedWhere,
        select: reservationSelect,
      }),
      client.reservation.findMany({
        where: pendingWhere,
        select: reservationSelect,
      }),
    ]);

    const approvedReservations = approved
      .filter((reservation) =>
        this.reservationOverlapsWindow(reservation, startAt, endAt),
      )
      .map((reservation) => ({
        id: reservation.id,
        usageDate: reservation.usageDate.toISOString(),
        startTime: reservation.startTime.toISOString(),
        endTime: reservation.endTime.toISOString(),
      }));

    let pendingReservations: MaintenanceImpact['pendingReservations'] = [];
    if (!isQuantity) {
      pendingReservations = pending
        .filter((reservation) =>
          this.reservationOverlapsWindow(reservation, startAt, endAt),
        )
        .map((reservation) => ({
          id: reservation.id,
          usageDate: reservation.usageDate.toISOString(),
          startTime: reservation.startTime.toISOString(),
          endTime: reservation.endTime.toISOString(),
          requestedQuantity: reservation.requestedQuantity,
        }));
    } else {
      const excludedApproved = new Set(
        approvedReservations.map((reservation) => reservation.id),
      );
      const seen = new Set<string>();
      for (const reservation of pending) {
        const dateKey = formatToJakartaDateString(reservation.usageDate);
        if (seen.has(dateKey)) {
          continue;
        }
        seen.add(dateKey);
        const infeasible =
          await this.reconciliation.findInfeasibleQuantityReservations(client, {
            facilityGroupId: facility.facilityGroupId,
            usageDate: reservation.usageDate,
            additionalMaintenance: { facilityId, startAt, endAt },
            excludedApprovedReservationIds: excludedApproved,
            overlapWindow: { startAt, endAt },
          });
        pendingReservations.push(
          ...infeasible.map((item) => ({
            id: item.id,
            usageDate: item.usageDate.toISOString(),
            startTime: item.startTime.toISOString(),
            endTime: item.endTime.toISOString(),
            requestedQuantity: item.requestedQuantity,
          })),
        );
      }
    }

    return {
      facilityId,
      approvedReservations,
      pendingReservations,
    };
  }

  private reservationOverlapsWindow(
    reservation: { usageDate: Date; startTime: Date; endTime: Date },
    startAt: Date,
    endAt: Date,
  ) {
    const reservationStart = this.reservationInstant(
      reservation.usageDate,
      this.timeMinutes(reservation.startTime),
    );
    const reservationEnd = this.reservationInstant(
      reservation.usageDate,
      this.timeMinutes(reservation.endTime),
    );
    return reservationStart < endAt && reservationEnd > startAt;
  }

  private reservationInstant(usageDate: Date, minutes: number) {
    const date = formatToJakartaDateString(usageDate);
    const hours = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return new Date(
      `${date}T${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000+07:00`,
    );
  }

  private timeMinutes(value: Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  private usageDateStartUtc(value: Date) {
    const date = formatToJakartaDateString(value);
    return new Date(`${date}T00:00:00.000Z`);
  }

  private generateReportNumber(now: Date): string {
    const timestamp = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});
    const compact =
      `${timestamp.year}${timestamp.month}${timestamp.day}` +
      `${timestamp.hour}${timestamp.minute}${timestamp.second}`;
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `RPT-${compact}-${suffix}`;
  }

  private toResponse(report: ReportRecord): ReportResponse {
    return {
      id: report.id,
      reportNumber: report.reportNumber,
      reporter: report.reporter
        ? {
            id: report.reporter.id,
            name: report.reporter.name,
            identityNumber: report.reporter.identityNumber,
            email: report.reporter.email,
          }
        : undefined,
      facility: {
        id: report.facility.id,
        assetCode: report.facility.assetCode,
        name: report.facility.name,
        status: report.facility.status,
        facilityGroupId: report.facility.facilityGroupId,
        facilityGroupName: report.facility.facilityGroup.name,
        reservationMode: report.facility.facilityGroup.reservationMode,
      },
      category: report.category,
      categoryLabel: REPORT_CATEGORY_LABELS[report.category],
      description: report.description,
      status: report.status,
      statusLabel: REPORT_STATUS_LABELS[report.status],
      decisionReason: report.decisionReason,
      resolutionNote: report.resolutionNote,
      acceptedBy: report.acceptedBy,
      acceptedAt: report.acceptedAt?.toISOString() ?? null,
      resolvedBy: report.resolvedBy,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      processedBy: report.processedBy,
      attachments: report.attachments.map((attachment) => ({
        ...attachment,
        downloadUrl: `/reports/${report.id}/attachments/${attachment.id}`,
        createdAt: attachment.createdAt.toISOString(),
      })),
      maintenancePeriods: report.maintenancePeriods.map(
        (period): MaintenancePeriodResponse => ({
          ...period,
          startAt: period.startAt.toISOString(),
          endAt: period.endAt.toISOString(),
        }),
      ),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }
}
