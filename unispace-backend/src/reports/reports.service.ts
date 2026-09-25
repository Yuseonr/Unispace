import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { FacilityStatus, ReportStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
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
  toJakartaMinutesOfDay,
} from '../reservations/utils/reservation-time.util';
import type {
  MaintenancePeriodResponse,
  PaginatedReportsResponse,
  ReportAuditLogResponse,
  ReportResponse,
} from './reports.types';

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
      objectUrl: true,
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

type ImpactReservation = {
  id: string;
  usageDate: Date;
  startTime: Date;
  endTime: Date;
  requestedQuantity: number;
  status: string;
  facilityId: string | null;
  facilityGroupId: string | null;
};

type MaintenanceSyncResult = {
  facilitiesChecked: number;
  facilitiesUpdated: number;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async create(
    reporterId: string,
    input: CreateReportDto,
    files: Express.Multer.File[],
  ) {
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

    const uploaded = await Promise.all(
      files.map((file) => this.storage.uploadReportPhoto(file)),
    );

    try {
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
        uploaded.map((attachment) => this.storage.remove(attachment.objectKey)),
      );
      throw error;
    }
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

    if (
      report.status === ReportStatus.RESOLVED ||
      report.status === ReportStatus.REJECTED
    ) {
      throw new ConflictException({
        code: 'REPORT_INVALID_TRANSITION',
        message: 'This report is no longer actionable.',
      });
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.facilityReport.update({
        where: { id: reportId },
        data: {
          status:
            report.status === ReportStatus.NEW
              ? ReportStatus.IN_PROGRESS
              : report.status,
          acceptedById: report.acceptedById ?? staffId,
          acceptedAt: report.acceptedAt ?? now,
          processedById: staffId,
        },
        select: reportSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: REPORT_AUDIT_ACTIONS.ACCEPTED,
          entityType: REPORT_ENTITY_TYPE,
          entityId: reportId,
          metadata: {
            fromStatus: report.status,
            toStatus: changed.status,
            acceptedById: changed.acceptedById,
            acceptedAt: changed.acceptedAt?.toISOString() ?? null,
            processedById: staffId,
          },
        },
      });
      return changed;
    });

    return this.toResponse(updated);
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

    if (
      report.status === ReportStatus.RESOLVED ||
      report.status === ReportStatus.REJECTED
    ) {
      throw new ConflictException({
        code: 'REPORT_INVALID_TRANSITION',
        message: 'A rejected or resolved report cannot be rejected again.',
      });
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.facilityReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.REJECTED,
          decisionReason: reason.trim(),
          acceptedById: report.acceptedById ?? staffId,
          acceptedAt: report.acceptedAt ?? now,
          processedById: staffId,
        },
        select: reportSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: REPORT_AUDIT_ACTIONS.REJECTED,
          entityType: REPORT_ENTITY_TYPE,
          entityId: reportId,
          metadata: {
            fromStatus: report.status,
            toStatus: changed.status,
            decisionReason: reason.trim(),
            acceptedById: changed.acceptedById,
            acceptedAt: changed.acceptedAt?.toISOString() ?? null,
            processedById: staffId,
          },
        },
      });
      return changed;
    });

    return this.toResponse(updated);
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

    if (report.status !== ReportStatus.IN_PROGRESS) {
      throw new ConflictException({
        code: 'REPORT_INVALID_TRANSITION',
        message: 'Only a report in progress can be resolved.',
      });
    }

    const scheduledMaintenance = await this.prisma.maintenancePeriod.findFirst({
      where: {
        reportId,
        endAt: { gt: new Date() },
      },
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
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.facilityReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.RESOLVED,
          resolutionNote: resolutionNote.trim(),
          acceptedById: report.acceptedById ?? staffId,
          acceptedAt: report.acceptedAt ?? now,
          resolvedById: staffId,
          resolvedAt: now,
          processedById: staffId,
        },
        select: reportSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: REPORT_AUDIT_ACTIONS.RESOLVED,
          entityType: REPORT_ENTITY_TYPE,
          entityId: reportId,
          metadata: {
            fromStatus: report.status,
            toStatus: changed.status,
            resolutionNote: resolutionNote.trim(),
            resolvedById: changed.resolvedById,
            resolvedAt: changed.resolvedAt?.toISOString() ?? null,
            processedById: staffId,
          },
        },
      });
      return changed;
    });

    return this.toResponse(updated);
  }

  private maintenanceDates(input: {
    mode: MaintenanceMode;
    startDate?: string;
    endDate?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
  }) {
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

    return { dateStart, dateEnd };
  }

  async previewReportMaintenanceImpact(
    reportId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const report = await this.prisma.facilityReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true, facilityId: true },
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

    return {
      reportId,
      ...(await this.previewMaintenanceImpact(
        report.facilityId,
        startAt,
        endAt,
      )),
    };
  }

  async confirmMaintenancePeriod(
    staffId: string,
    reportId: string,
    input: {
      mode: MaintenanceMode;
      startDate?: string;
      endDate?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      cancelImpactedReservations: boolean;
      cancellationReason?: string;
      note?: string;
    },
  ) {
    const report = await this.prisma.facilityReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true, facilityId: true },
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

    return this.prisma.$transaction(async (tx) => {
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

      const approvedResult =
        approvedIds.length === 0
          ? { count: 0 }
          : await tx.reservation.updateMany({
              where: { id: { in: approvedIds }, status: 'APPROVED' },
              data: {
                status: 'CANCELLED_BY_STAFF',
                decisionReason: reason,
                processedById: staffId,
                cancelledAt: now,
              },
            });
      const pendingResult =
        pendingIds.length === 0
          ? { count: 0 }
          : await tx.reservation.updateMany({
              where: { id: { in: pendingIds }, status: 'PENDING' },
              data: {
                status: 'REJECTED',
                decisionReason: reason,
                processedById: staffId,
                decidedAt: now,
              },
            });

      const period = await tx.maintenancePeriod.create({
        data: {
          facilityId: report.facilityId,
          reportId,
          startAt: dateStart,
          endAt: dateEnd,
          note: input.note ?? reason,
        },
      });

      await this.syncEffectiveFacilityStatus(
        tx,
        report.facilityId,
        staffId,
        now,
      );
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
            approvedCancellations: approvedResult.count,
            pendingRejections: pendingResult.count,
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
        approvedCancelled: approvedResult.count,
        pendingRejected: pendingResult.count,
      };
    });
  }

  async endMaintenancePeriod(staffId: string, periodId: string, endAt: Date) {
    const maintenance = await this.prisma.maintenancePeriod.findUnique({
      where: { id: periodId },
    });

    if (!maintenance) {
      throw new NotFoundException({
        code: 'MAINTENANCE_PERIOD_NOT_FOUND',
        message: 'The maintenance period was not found.',
      });
    }

    if (endAt <= maintenance.startAt) {
      throw new ConflictException({
        code: 'MAINTENANCE_INVALID_OVERRIDE',
        message: 'Maintenance end time must be after the original start time.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.maintenancePeriod.update({
        where: { id: periodId },
        data: { endAt },
      });

      await this.syncEffectiveFacilityStatus(
        tx,
        maintenance.facilityId,
        staffId,
        endAt,
      );

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: REPORT_AUDIT_ACTIONS.MAINTENANCE_ENDED_EARLY,
          entityType: 'MAINTENANCE_PERIOD',
          entityId: periodId,
          metadata: {
            facilityId: maintenance.facilityId,
            reportId: maintenance.reportId,
            oldEndAt: maintenance.endAt.toISOString(),
            newEndAt: endAt.toISOString(),
          },
        },
      });

      return changed;
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

  async syncExpiredMaintenancePeriods(
    now = new Date(),
  ): Promise<MaintenanceSyncResult> {
    const affected = await this.prisma.maintenancePeriod.findMany({
      where: { startAt: { lte: now } },
      select: { facilityId: true },
      distinct: ['facilityId'],
    });

    let facilitiesUpdated = 0;
    for (const { facilityId } of affected) {
      const changed = await this.syncEffectiveFacilityStatus(
        this.prisma,
        facilityId,
        null,
        now,
      );
      if (changed) {
        facilitiesUpdated++;
      }
    }

    return {
      facilitiesChecked: affected.length,
      facilitiesUpdated,
    };
  }

  private async syncEffectiveFacilityStatus(
    transaction: Prisma.TransactionClient,
    facilityId: string,
    actorId: string | null,
    effectiveAt: Date,
  ): Promise<boolean> {
    const facility = await transaction.facility.findUnique({
      where: { id: facilityId },
      select: { status: true },
    });

    if (!facility || facility.status === FacilityStatus.NONACTIVE) {
      return false;
    }

    const activePeriod = await transaction.maintenancePeriod.findFirst({
      where: {
        facilityId,
        startAt: { lte: effectiveAt },
        endAt: { gt: effectiveAt },
      },
      select: { id: true },
    });
    const nextStatus = activePeriod
      ? FacilityStatus.IN_MAINTENANCE
      : FacilityStatus.ACTIVE;

    if (facility.status === nextStatus) {
      return false;
    }

    await transaction.facility.update({
      where: { id: facilityId },
      data: { status: nextStatus },
    });
    await transaction.facilityStatusHistory.create({
      data: {
        facilityId,
        status: nextStatus,
        changedById: actorId,
        effectiveAt,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: REPORT_AUDIT_ACTIONS.FACILITY_STATUS_CHANGED,
        entityType: FACILITY_ENTITY_TYPE,
        entityId: facilityId,
        metadata: {
          fromStatus: facility.status,
          toStatus: nextStatus,
          effectiveAt: effectiveAt.toISOString(),
          source: 'MAINTENANCE_PERIOD',
          automatic: actorId === null,
        },
      },
    });
    return true;
  }

  async previewMaintenanceImpact(
    facilityId: string,
    startAt: Date,
    endAt: Date,
  ) {
    return this.getMaintenanceImpact(facilityId, startAt, endAt, this.prisma);
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
    const toMinutesOfDay = (value: Date) => {
      const time = new Date(value);
      return time.getUTCHours() * 60 + time.getUTCMinutes();
    };

    const toJakartaInstant = (usageDate: Date, timeMinutes: number) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = formatToJakartaDateString(usageDate);
      const hour = Math.floor(timeMinutes / 60);
      const minute = timeMinutes % 60;
      return new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00.000+07:00`);
    };

    const windowStartMinutes = toJakartaMinutesOfDay(startAt);
    const windowEndMinutes = toJakartaMinutesOfDay(endAt);
    const windowStartJakarta = formatToJakartaDateString(startAt);
    const windowEndJakarta = formatToJakartaDateString(endAt);

    const facility = await client.facility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        facilityGroupId: true,
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

    const impacted: ImpactReservation[] = await client.reservation.findMany({
      where: {
        OR: [
          { facilityId, status: 'APPROVED' },
          { facilityId, status: 'PENDING' },
          { facilityGroupId: facility.facilityGroupId, status: 'APPROVED' },
          { facilityGroupId: facility.facilityGroupId, status: 'PENDING' },
        ],
        usageDate: {
          gte: new Date(`${windowStartJakarta}T00:00:00.000+07:00`),
          lte: new Date(`${windowEndJakarta}T23:59:59.999+07:00`),
        },
      },
      select: {
        id: true,
        usageDate: true,
        startTime: true,
        endTime: true,
        requestedQuantity: true,
        status: true,
        facilityId: true,
        facilityGroupId: true,
      },
    });
    const maintenancePeriods =
      (await client.maintenancePeriod.findMany({
        where: {
          facilityId: {
            in: (facility.facilityGroup.facilities ?? []).map(
              (unit: { id: string }) => unit.id,
            ),
          },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { facilityId: true, startAt: true, endAt: true },
      })) ?? [];

    const approvedReservations = impacted
      .filter((reservation) => reservation.status === 'APPROVED')
      .filter((reservation) => {
        const reservationStartMinutes = toMinutesOfDay(reservation.startTime);
        const reservationEndMinutes = toMinutesOfDay(reservation.endTime);
        return (
          reservationStartMinutes < windowEndMinutes &&
          reservationEndMinutes > windowStartMinutes
        );
      })
      .map((reservation) => ({
        id: reservation.id,
        usageDate: reservation.usageDate.toISOString(),
        startTime: reservation.startTime.toISOString(),
        endTime: reservation.endTime.toISOString(),
      }));

    const pendingReservations = impacted
      .filter((reservation) => reservation.status === 'PENDING')
      .filter((reservation) => {
        const reservationStartMinutes = toMinutesOfDay(reservation.startTime);
        const reservationEndMinutes = toMinutesOfDay(reservation.endTime);
        return (
          reservationStartMinutes < windowEndMinutes &&
          reservationEndMinutes > windowStartMinutes
        );
      })
      .filter((reservation) => {
        if (facility.facilityGroup.reservationMode !== 'QUANTITY') {
          return true;
        }

        const reservationStart = toMinutesOfDay(reservation.startTime);
        const reservationEnd = toMinutesOfDay(reservation.endTime);
        const usageDate = reservation.usageDate;
        const reservationStartAt = toJakartaInstant(
          usageDate,
          reservationStart,
        );
        const reservationEndAt = toJakartaInstant(usageDate, reservationEnd);
        const overlappingApprovedQuantity = impacted
          .filter(
            (candidate) =>
              candidate.status === 'APPROVED' &&
              candidate.facilityGroupId === facility.facilityGroupId &&
              candidate.usageDate.getTime() ===
                reservation.usageDate.getTime() &&
              toMinutesOfDay(candidate.startTime) < reservationEnd &&
              toMinutesOfDay(candidate.endTime) > reservationStart,
          )
          .reduce((sum, candidate) => sum + candidate.requestedQuantity, 0);
        const existingMaintenanceCount = new Set(
          maintenancePeriods
            .filter(
              (period: { startAt: Date; endAt: Date }) =>
                period.startAt < reservationEndAt &&
                period.endAt > reservationStartAt,
            )
            .map((period: { facilityId: string }) => period.facilityId),
        ).size;
        const targetUnitOverlaps =
          startAt < reservationEndAt && endAt > reservationStartAt;
        const targetUnitAlreadyCounted = maintenancePeriods.some(
          (period: { facilityId: string; startAt: Date; endAt: Date }) =>
            period.facilityId === facilityId &&
            period.startAt < reservationEndAt &&
            period.endAt > reservationStartAt,
        );
        const maintenanceCount =
          existingMaintenanceCount +
          (targetUnitOverlaps && !targetUnitAlreadyCounted ? 1 : 0);
        const activeUnits = facility.facilityGroup.facilities?.length ?? 0;

        return (
          reservation.requestedQuantity >
          Math.max(
            0,
            activeUnits - maintenanceCount - overlappingApprovedQuantity,
          )
        );
      })
      .map((reservation) => ({
        id: reservation.id,
        usageDate: reservation.usageDate.toISOString(),
        startTime: reservation.startTime.toISOString(),
        endTime: reservation.endTime.toISOString(),
        requestedQuantity: reservation.requestedQuantity,
      }));

    return {
      facilityId,
      approvedReservations,
      pendingReservations,
    };
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
