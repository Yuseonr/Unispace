import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import {
	FacilityStatus,
	ReportCategory,
	ReportStatus,
} from '../generated/prisma/client';
import { MaintenanceMode } from './reports.constants';
import { PrismaService } from '../database/prisma.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
import { ListStaffReportsDto } from './dto/list-staff-reports.dto';
import {
	REPORT_CATEGORY_LABELS,
	FACILITY_ENTITY_TYPE,
	MAINTENANCE_ENTITY_TYPE,
	REPORT_AUDIT_ACTIONS,
	REPORT_ENTITY_TYPE,
	REPORT_STATUS_LABELS,
} from './reports.constants';
import { ListReportAuditDto } from './dto/list-report-audit.dto';
import type {
	MaintenancePeriodResponse,
	PaginatedReportsResponse,
	ReportAuditLogResponse,
	ReportResponse,
} from './reports.types';

const reportSelect = {
	id: true,
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
		if (facility.status !== FacilityStatus.ACTIVE) {
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

	async listStaff(query: ListStaffReportsDto): Promise<PaginatedReportsResponse> {
		const where: Prisma.FacilityReportWhereInput = {
			...(query.status === undefined ? {} : { status: query.status }),
			...(query.facilityId === undefined ? {} : { facilityId: query.facilityId }),
			...(query.createdFrom === undefined && query.createdTo === undefined
				? {}
				: {
						createdAt: {
							...(query.createdFrom === undefined ? {} : { gte: new Date(query.createdFrom) }),
							...(query.createdTo === undefined ? {} : { lte: new Date(query.createdTo) }),
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
					? [{ entityType: MAINTENANCE_ENTITY_TYPE, entityId: { in: maintenanceIds } }]
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

		if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.REJECTED) {
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
					status: report.status === ReportStatus.NEW ? ReportStatus.IN_PROGRESS : report.status,
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

	async reject(staffId: string, reportId: string, reason: string): Promise<ReportResponse> {
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

		if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.REJECTED) {
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

	async resolve(staffId: string, reportId: string, resolutionNote: string): Promise<ReportResponse> {
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

		if (report.status !== ReportStatus.IN_PROGRESS && report.status !== ReportStatus.NEW) {
			throw new ConflictException({
				code: 'REPORT_INVALID_TRANSITION',
				message: 'Only a report in progress can be resolved.',
			});
		}

		const scheduledMaintenance = await this.prisma.maintenancePeriod.findFirst({
			where: {
				facilityId: report.facility.id,
				endAt: { gt: new Date() },
			},
			select: { id: true },
		});

		if (scheduledMaintenance) {
			throw new ConflictException({
				code: 'REPORT_MAINTENANCE_STILL_ACTIVE_OR_SCHEDULED',
				message: 'This report cannot be resolved while maintenance is active or scheduled.',
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

	async createMaintenancePeriod(
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
				code: 'REPORT_NOT_IN_PROGRESS',
				message: 'Only IN_PROGRESS reports can create maintenance periods.',
			});
		}

		const dateStart = input.mode === MaintenanceMode.DATE_RANGE
			? new Date(`${input.startDate ?? input.date}T07:00:00.000+07:00`)
			: new Date(`${input.date}T${input.startTime ?? '07:00'}:00.000+07:00`);
		const dateEnd = input.mode === MaintenanceMode.DATE_RANGE
			? new Date(`${input.endDate ?? input.date}T20:00:00.000+07:00`)
			: new Date(`${input.date}T${input.endTime ?? '20:00'}:00.000+07:00`);

		if (dateEnd <= dateStart) {
			throw new ConflictException({
				code: 'MAINTENANCE_INVALID_RANGE',
				message: 'Maintenance end time must be after start time.',
			});
		}

		if (input.cancelImpactedReservations && !input.cancellationReason?.trim()) {
			throw new ConflictException({
				code: 'MAINTENANCE_REASON_REQUIRED',
				message: 'A cancellation reason is required for impacted reservations.',
			});
		}

		const period = await this.prisma.$transaction(async (tx) => {
			const created = await tx.maintenancePeriod.create({
				data: {
					facilityId: report.facility.id,
					reportId: report.id,
					startAt: dateStart,
					endAt: dateEnd,
					note: input.note ?? input.cancellationReason ?? null,
				},
			});

			await this.syncEffectiveFacilityStatus(tx, report.facility.id, staffId, new Date());

			await tx.auditLog.create({
				data: {
					actorId: staffId,
					action: REPORT_AUDIT_ACTIONS.MAINTENANCE_CREATED,
					entityType: 'MAINTENANCE_PERIOD',
					entityId: created.id,
					metadata: {
						reportId: report.id,
						facilityId: report.facility.id,
						mode: input.mode,
						cancelImpactedReservations: input.cancelImpactedReservations,
						cancellationReason: input.cancellationReason ?? null,
					},
				},
			});

			return created;
		});

		return {
			id: period.id,
			facilityId: period.facilityId,
			reportId: period.reportId,
			startAt: period.startAt.toISOString(),
			endAt: period.endAt.toISOString(),
			note: period.note,
		};
	}

	async endMaintenancePeriod(
		staffId: string,
		periodId: string,
		endAt: Date,
	) {
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

			await this.syncEffectiveFacilityStatus(tx, maintenance.facilityId, staffId, endAt);

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

	private async syncEffectiveFacilityStatus(
		transaction: Prisma.TransactionClient,
		facilityId: string,
		actorId: string,
		effectiveAt: Date,
	) {
		const facility = await transaction.facility.findUnique({
			where: { id: facilityId },
			select: { status: true },
		});

		if (!facility || facility.status === FacilityStatus.NONACTIVE) {
			return;
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
			return;
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
				},
			},
		});
	}

	async previewMaintenanceImpact(
		facilityId: string,
		startAt: Date,
		endAt: Date,
	) {
		const toMinutesOfDay = (value: Date) => {
			const time = new Date(value);
			return time.getUTCHours() * 60 + time.getUTCMinutes();
		};

		const windowStartMinutes = toMinutesOfDay(startAt);
		const windowEndMinutes = toMinutesOfDay(endAt);

		const facility = await this.prisma.facility.findUnique({
			where: { id: facilityId },
			select: {
				id: true,
				facilityGroupId: true,
				facilityGroup: { select: { reservationMode: true } },
			},
		});

		if (!facility) {
			throw new NotFoundException({
				code: 'FACILITY_NOT_FOUND',
				message: 'The facility was not found.',
			});
		}

		const impacted = await this.prisma.reservation.findMany({
			where: {
				OR: [
					{ facilityId, status: 'APPROVED' },
					{ facilityId, status: 'PENDING' },
					{ facilityGroupId: facility.facilityGroupId, status: 'APPROVED' },
					{ facilityGroupId: facility.facilityGroupId, status: 'PENDING' },
				],
				usageDate: {
					gte: new Date(startAt.toISOString().slice(0, 10) + 'T00:00:00.000Z'),
					lte: new Date(endAt.toISOString().slice(0, 10) + 'T23:59:59.999Z'),
				},
			},
			select: {
				id: true,
				usageDate: true,
				startTime: true,
				endTime: true,
				requestedQuantity: true,
				status: true,
			},
		});

		const approvedReservations = impacted
			.filter((reservation) => reservation.status === 'APPROVED')
			.filter((reservation) => {
				const reservationStartMinutes = toMinutesOfDay(reservation.startTime);
				const reservationEndMinutes = toMinutesOfDay(reservation.endTime);
				return reservationStartMinutes < windowEndMinutes && reservationEndMinutes > windowStartMinutes;
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
				return reservationStartMinutes < windowEndMinutes && reservationEndMinutes > windowStartMinutes;
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

	async confirmMaintenanceImpact(
		staffId: string,
		facilityId: string,
		startAt: Date,
		endAt: Date,
		reason: string,
	) {
		const preview = await this.previewMaintenanceImpact(facilityId, startAt, endAt);

		if (!reason || !reason.trim()) {
			throw new ConflictException({
				code: 'MAINTENANCE_REASON_REQUIRED',
				message: 'A maintenance cancellation reason is required.',
			});
		}

		const trimmedReason = reason.trim();

		const approvedIds = preview.approvedReservations.map((reservation) => reservation.id);
		const pendingIds = preview.pendingReservations.map((reservation) => reservation.id);

		const { approvedResult, rejectedResult } = await this.prisma.$transaction(async (tx) => {
			const approvedResult = await tx.reservation.updateMany({
				where: { id: { in: approvedIds }, status: 'APPROVED' },
				data: {
					status: 'CANCELLED_BY_STAFF',
					decisionReason: trimmedReason,
					processedById: staffId,
					cancelledAt: new Date(),
				},
			});

			const rejectedResult = await tx.reservation.updateMany({
				where: { id: { in: pendingIds }, status: 'PENDING' },
				data: {
					status: 'REJECTED',
					decisionReason: trimmedReason,
					processedById: staffId,
					decidedAt: new Date(),
				},
			});

			await tx.auditLog.create({
				data: {
					actorId: staffId,
					action: REPORT_AUDIT_ACTIONS.MAINTENANCE_IMPACT_CONFIRMED,
					entityType: FACILITY_ENTITY_TYPE,
					entityId: facilityId,
					metadata: {
						facilityId,
						startAt: startAt.toISOString(),
						endAt: endAt.toISOString(),
						approvedCandidates: approvedIds.length,
						approvedCancellations: approvedResult.count,
						pendingCandidates: pendingIds.length,
						pendingRejections: rejectedResult.count,
						reason: trimmedReason,
					},
				},
			});

			return { approvedResult, rejectedResult };
		});

		return {
			facilityId,
			approvedReservations: preview.approvedReservations,
			pendingReservations: preview.pendingReservations,
			approvedCancelled: approvedResult.count,
			pendingRejected: rejectedResult.count,
		};
	}

	private toResponse(report: ReportRecord): ReportResponse {
		return {
			id: report.id,
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
