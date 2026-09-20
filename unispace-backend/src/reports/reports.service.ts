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
import { PrismaService } from '../database/prisma.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
import { ListStaffReportsDto } from './dto/list-staff-reports.dto';
import {
	REPORT_CATEGORY_LABELS,
	REPORT_ENTITY_TYPE,
	REPORT_STATUS_LABELS,
} from './reports.constants';
import type {
	MaintenancePeriodResponse,
	PaginatedReportsResponse,
	ReportResponse,
} from './reports.types';

const reportSelect = {
	id: true,
	category: true,
	description: true,
	status: true,
	decisionReason: true,
	resolutionNote: true,
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
					action: 'REPORT_CREATED',
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
