import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FacilityStatus,
  type Prisma,
  ReportCategory,
  ReportStatus,
  ReservationMode,
  ReservationStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  AnalyticsFilterDto,
  AnalyticsTrendInterval,
  AnalyticsTrendMetric,
  AnalyticsTrendDto,
  FacilityReportHistoryDto,
} from './dto';

const JAKARTA_OFFSET = '+07:00';
const SLOT_MINUTES = 30;
const OPERATION_START_MINUTES = 7 * 60;
const OPERATION_END_MINUTES = 20 * 60;
const MAX_ANALYTICS_DAYS = 366;
const INCLUDED_RESERVATION_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.APPROVED,
  ReservationStatus.COMPLETED,
]);
const INCLUDED_DAMAGE_REPORT_STATUSES = new Set<ReportStatus>([
  ReportStatus.NEW,
  ReportStatus.IN_PROGRESS,
  ReportStatus.RESOLVED,
]);

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  [ReportCategory.PHYSICAL_DAMAGE]: 'Kerusakan Fisik',
  [ReportCategory.ELECTRICAL_ELECTRONICS]: 'Listrik/Elektronik',
  [ReportCategory.CLEANLINESS]: 'Kebersihan',
  [ReportCategory.FURNITURE_EQUIPMENT]: 'Furnitur/Perlengkapan',
  [ReportCategory.SECURITY]: 'Keamanan',
  [ReportCategory.OTHER]: 'Lainnya',
};

type AnalyticsWindow = {
  dateFrom: string;
  dateTo: string;
  startAt: Date;
  endExclusiveAt: Date;
  usageDateStart: Date;
  usageDateEnd: Date;
};

type NormalizedAnalyticsFilter = AnalyticsWindow & {
  facilityAreaId?: string;
  facilityTypeId?: string;
  facilityGroupId?: string;
  facilityId?: string;
  reservationMode?: ReservationMode;
};

type AnalyticsFacility = {
  id: string;
  assetCode: string;
  name: string | null;
  status: FacilityStatus;
  createdAt: Date;
  facilityGroup: {
    id: string;
    name: string;
    reservationMode: ReservationMode;
    facilityType: { id: string; name: string };
    facilityArea: { id: string; code: string; name: string };
  };
  statusHistory: Array<{ status: FacilityStatus; effectiveAt: Date }>;
};

type AnalyticsReservation = {
  id: string;
  facilityId: string | null;
  facilityGroupId: string | null;
  requestedQuantity: number;
  status: ReservationStatus;
  usageDate: Date;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  decidedAt: Date | null;
  items: Array<{ facilityId: string }>;
};

type AnalyticsReport = {
  id: string;
  reportNumber: string;
  category: ReportCategory;
  status: ReportStatus;
  createdAt: Date;
  acceptedAt: Date | null;
  resolvedAt: Date | null;
  decisionReason: string | null;
  resolutionNote: string | null;
  reporter: { id: string; name: string; identityNumber: string; email: string };
  acceptedBy: { id: string; name: string } | null;
  resolvedBy: { id: string; name: string } | null;
  facility: {
    id: string;
    assetCode: string;
    name: string | null;
    facilityGroup: {
      id: string;
      name: string;
      reservationMode: ReservationMode;
      facilityType: { id: string; name: string };
      facilityArea: { id: string; code: string; name: string };
    };
  };
};

type AnalyticsDataset = {
  filter: NormalizedAnalyticsFilter;
  facilities: AnalyticsFacility[];
  reservations: AnalyticsReservation[];
  reports: AnalyticsReport[];
  generatedAt: string;
};

type OccupancyResult = {
  bookedSlots: number;
  availableSlots: number;
  percentage: number | null;
  facilities: Array<{
    facilityId: string;
    assetCode: string;
    name: string;
    facilityGroupId: string;
    facilityGroupName: string;
    facilityArea: { id: string; code: string; name: string };
    facilityType: { id: string; name: string };
    currentStatus: FacilityStatus;
    historicalNonactive: boolean;
    bookedSlots: number;
    availableSlots: number;
    percentage: number | null;
  }>;
};

type EquipmentUtilizationResult = {
  usedUnitSlots: number;
  availableUnitSlots: number;
  percentage: number | null;
  facilityGroups: Array<{
    facilityGroupId: string;
    name: string;
    facilityArea: { id: string; code: string; name: string };
    facilityType: { id: string; name: string };
    currentNonactiveUnits: number;
    totalUnits: number;
    historicalNonactive: boolean;
    usedUnitSlots: number;
    availableUnitSlots: number;
    percentage: number | null;
  }>;
};

/**
 * Satu sumber query dan rumus untuk seluruh analytics. Data dibaca per set
 * terfilter; perhitungan slot tidak pernah melakukan query per kartu atau slot.
 */
@Injectable()
export class AnalyticsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(input: AnalyticsFilterDto) {
    const dataset = await this.createDataset(input);
    const includedReservations = dataset.reservations.filter((reservation) =>
      INCLUDED_RESERVATION_STATUSES.has(reservation.status),
    );
    const damageReports = dataset.reports.filter((report) =>
      INCLUDED_DAMAGE_REPORT_STATUSES.has(report.status),
    );
    const decisionHours = dataset.reservations
      .filter((reservation) => reservation.decidedAt)
      .map((reservation) =>
        this.hoursBetween(reservation.createdAt, reservation.decidedAt!),
      );
    const resolutionHours = dataset.reports
      .filter(
        (report) =>
          report.status === ReportStatus.RESOLVED && report.resolvedAt,
      )
      .map((report) => this.hoursBetween(report.createdAt, report.resolvedAt!));

    return this.withMetadata(dataset, {
      reservations: {
        total: dataset.reservations.length,
        approvedOrCompleted: includedReservations.length,
        totalUsedHours: this.round(
          includedReservations.reduce(
            (total, reservation) =>
              total + this.reservationDurationHours(reservation),
            0,
          ),
        ),
        byStatus: this.countByEnum(
          dataset.reservations,
          (reservation) => reservation.status,
          Object.values(ReservationStatus),
        ),
        decisionTimeHours: this.durationStats(decisionHours),
      },
      reports: {
        total: dataset.reports.length,
        qualifyingDamageReports: damageReports.length,
        byStatus: this.countByEnum(
          dataset.reports,
          (report) => report.status,
          Object.values(ReportStatus),
        ),
        resolutionTimeHours: this.durationStats(resolutionHours),
      },
      facilities: {
        totalUnits: dataset.facilities.length,
        currentNonactiveUnits: dataset.facilities.filter(
          (facility) => facility.status === FacilityStatus.NONACTIVE,
        ).length,
        historicalNonactiveUnits: dataset.facilities.filter((facility) =>
          this.wasNonactiveInWindow(facility, dataset.filter),
        ).length,
      },
    });
  }

  async occupancy(input: AnalyticsFilterDto) {
    const dataset = await this.createDataset(input);
    return this.withMetadata(
      dataset,
      this.calculateOccupancy(dataset, dataset.filter),
    );
  }

  async equipmentUtilization(input: AnalyticsFilterDto) {
    const dataset = await this.createDataset(input);
    return this.withMetadata(
      dataset,
      this.calculateEquipmentUtilization(dataset, dataset.filter),
    );
  }

  async damageFrequency(input: AnalyticsFilterDto) {
    const dataset = await this.createDataset(input);
    return this.withMetadata(
      dataset,
      this.calculateDamageFrequency(dataset, dataset.filter),
    );
  }

  async trends(input: AnalyticsTrendDto) {
    const dataset = await this.createDataset(input);
    const windows = this.trendWindows(dataset.filter, input.interval);
    const series = windows.map((window) => {
      if (input.metric === AnalyticsTrendMetric.OCCUPANCY) {
        const result = this.calculateOccupancy(dataset, window);
        return {
          period: this.periodLabel(window, input.interval),
          numerator: result.bookedSlots,
          denominator: result.availableSlots,
          percentage: result.percentage,
        };
      }
      if (input.metric === AnalyticsTrendMetric.EQUIPMENT_UTILIZATION) {
        const result = this.calculateEquipmentUtilization(dataset, window);
        return {
          period: this.periodLabel(window, input.interval),
          numerator: result.usedUnitSlots,
          denominator: result.availableUnitSlots,
          percentage: result.percentage,
        };
      }
      const result = this.calculateDamageFrequency(dataset, window);
      return {
        period: this.periodLabel(window, input.interval),
        count: result.total,
      };
    });
    return this.withMetadata(dataset, {
      metric: input.metric,
      interval: input.interval,
      series,
    });
  }

  async facilityReportHistory(input: FacilityReportHistoryDto) {
    const dataset = await this.createDataset(input);
    const sorted = [...dataset.reports].sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() ||
        right.id.localeCompare(left.id),
    );
    const start = (input.page - 1) * input.limit;
    const items = sorted
      .slice(start, start + input.limit)
      .map((report) => this.reportHistoryItem(report));
    return this.withMetadata(dataset, {
      items,
      page: input.page,
      limit: input.limit,
      total: sorted.length,
      totalPages: Math.ceil(sorted.length / input.limit),
    });
  }

  async facilityReportHistoryForExport(input: AnalyticsFilterDto) {
    const dataset = await this.createDataset(input);
    const items = [...dataset.reports]
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      )
      .map((report) => this.reportHistoryItem(report));
    return this.withMetadata(dataset, { items, total: items.length });
  }

  private reportHistoryItem(report: AnalyticsReport) {
    return {
      id: report.id,
      reportNumber: report.reportNumber,
      category: report.category,
      categoryLabel: CATEGORY_LABELS[report.category],
      status: report.status,
      facility: {
        id: report.facility.id,
        assetCode: report.facility.assetCode,
        name: report.facility.name ?? report.facility.facilityGroup.name,
        facilityGroup: {
          id: report.facility.facilityGroup.id,
          name: report.facility.facilityGroup.name,
          reservationMode: report.facility.facilityGroup.reservationMode,
        },
        facilityArea: report.facility.facilityGroup.facilityArea,
        facilityType: report.facility.facilityGroup.facilityType,
      },
      reporter: report.reporter,
      acceptedBy: report.acceptedBy,
      resolvedBy: report.resolvedBy,
      createdAt: report.createdAt.toISOString(),
      acceptedAt: report.acceptedAt?.toISOString() ?? null,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      resolutionHours:
        report.resolvedAt && report.status === ReportStatus.RESOLVED
          ? this.round(this.hoursBetween(report.createdAt, report.resolvedAt))
          : null,
      decisionReason: report.decisionReason,
      resolutionNote: report.resolutionNote,
    };
  }

  private async createDataset(
    input: AnalyticsFilterDto,
  ): Promise<AnalyticsDataset> {
    const filter = await this.normalizeFilter(input);
    const facilityWhere: Prisma.FacilityWhereInput = {
      ...(filter.facilityId ? { id: filter.facilityId } : {}),
      facilityGroup: {
        ...(filter.facilityGroupId ? { id: filter.facilityGroupId } : {}),
        ...(filter.facilityAreaId
          ? { facilityAreaId: filter.facilityAreaId }
          : {}),
        ...(filter.facilityTypeId
          ? { facilityTypeId: filter.facilityTypeId }
          : {}),
        ...(filter.reservationMode
          ? { reservationMode: filter.reservationMode }
          : {}),
      },
    };
    const facilities = await this.prisma.facility.findMany({
      where: facilityWhere,
      select: {
        id: true,
        assetCode: true,
        name: true,
        status: true,
        createdAt: true,
        statusHistory: {
          where: { effectiveAt: { lt: filter.endExclusiveAt } },
          select: { status: true, effectiveAt: true },
          orderBy: { effectiveAt: 'asc' },
        },
        facilityGroup: {
          select: {
            id: true,
            name: true,
            reservationMode: true,
            facilityType: { select: { id: true, name: true } },
            facilityArea: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ facilityGroup: { name: 'asc' } }, { assetCode: 'asc' }],
    });
    const facilityIds = facilities.map((facility) => facility.id);
    const exclusiveIds = facilities
      .filter(
        (facility) =>
          facility.facilityGroup.reservationMode === ReservationMode.EXCLUSIVE,
      )
      .map((facility) => facility.id);
    const quantityGroupIds = [
      ...new Set(
        facilities
          .filter(
            (facility) =>
              facility.facilityGroup.reservationMode ===
              ReservationMode.QUANTITY,
          )
          .map((facility) => facility.facilityGroup.id),
      ),
    ];
    const reservationWhere: Prisma.ReservationWhereInput = {
      usageDate: { gte: filter.usageDateStart, lte: filter.usageDateEnd },
      OR: [
        ...(exclusiveIds.length ? [{ facilityId: { in: exclusiveIds } }] : []),
        ...(quantityGroupIds.length
          ? [{ facilityGroupId: { in: quantityGroupIds } }]
          : []),
      ],
    };
    const reportWhere: Prisma.FacilityReportWhereInput = {
      facilityId: { in: facilityIds },
      createdAt: { gte: filter.startAt, lt: filter.endExclusiveAt },
    };
    const [reservations, reports] = await Promise.all([
      this.prisma.reservation.findMany({
        where: reservationWhere,
        select: {
          id: true,
          facilityId: true,
          facilityGroupId: true,
          requestedQuantity: true,
          status: true,
          usageDate: true,
          startTime: true,
          endTime: true,
          createdAt: true,
          decidedAt: true,
          items: { select: { facilityId: true } },
        },
      }),
      this.prisma.facilityReport.findMany({
        where: reportWhere,
        select: {
          id: true,
          reportNumber: true,
          category: true,
          status: true,
          createdAt: true,
          acceptedAt: true,
          resolvedAt: true,
          decisionReason: true,
          resolutionNote: true,
          reporter: {
            select: { id: true, name: true, identityNumber: true, email: true },
          },
          acceptedBy: { select: { id: true, name: true } },
          resolvedBy: { select: { id: true, name: true } },
          facility: {
            select: {
              id: true,
              assetCode: true,
              name: true,
              facilityGroup: {
                select: {
                  id: true,
                  name: true,
                  reservationMode: true,
                  facilityType: { select: { id: true, name: true } },
                  facilityArea: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    return {
      filter,
      facilities,
      reservations,
      reports,
      generatedAt: new Date().toISOString(),
    };
  }

  private async normalizeFilter(
    input: AnalyticsFilterDto,
  ): Promise<NormalizedAnalyticsFilter> {
    const start = this.parseDate(input.dateFrom);
    const end = this.parseDate(input.dateTo);
    if (start > end) {
      throw new BadRequestException({
        code: 'INVALID_ANALYTICS_DATE_RANGE',
        message: 'dateFrom tidak boleh setelah dateTo.',
      });
    }
    const days = this.daysBetween(start, end) + 1;
    if (days > MAX_ANALYTICS_DAYS) {
      throw new BadRequestException({
        code: 'ANALYTICS_DATE_RANGE_TOO_LARGE',
        message: 'Rentang analytics maksimal 366 hari.',
      });
    }
    const [area, type, group, facility] = await Promise.all([
      input.facilityAreaId
        ? this.prisma.facilityArea.findUnique({
            where: { id: input.facilityAreaId },
            select: { id: true },
          })
        : undefined,
      input.facilityTypeId
        ? this.prisma.facilityType.findUnique({
            where: { id: input.facilityTypeId },
            select: { id: true },
          })
        : undefined,
      input.facilityGroupId
        ? this.prisma.facilityGroup.findUnique({
            where: { id: input.facilityGroupId },
            select: {
              id: true,
              facilityAreaId: true,
              facilityTypeId: true,
              reservationMode: true,
            },
          })
        : undefined,
      input.facilityId
        ? this.prisma.facility.findUnique({
            where: { id: input.facilityId },
            select: {
              id: true,
              facilityGroupId: true,
              facilityGroup: {
                select: {
                  facilityAreaId: true,
                  facilityTypeId: true,
                  reservationMode: true,
                },
              },
            },
          })
        : undefined,
    ]);
    if ((input.facilityAreaId && !area) || (input.facilityTypeId && !type)) {
      throw new BadRequestException({
        code: 'ANALYTICS_FILTER_NOT_FOUND',
        message: 'Filter area atau tipe fasilitas tidak ditemukan.',
      });
    }
    if (input.facilityGroupId && !group) {
      throw new BadRequestException({
        code: 'ANALYTICS_FILTER_NOT_FOUND',
        message: 'Kelompok fasilitas tidak ditemukan.',
      });
    }
    if (input.facilityId && !facility) {
      throw new BadRequestException({
        code: 'ANALYTICS_FILTER_NOT_FOUND',
        message: 'Unit fasilitas tidak ditemukan.',
      });
    }
    const target =
      group ??
      (facility
        ? {
            id: facility.facilityGroupId,
            facilityAreaId: facility.facilityGroup.facilityAreaId,
            facilityTypeId: facility.facilityGroup.facilityTypeId,
            reservationMode: facility.facilityGroup.reservationMode,
          }
        : undefined);
    if (
      target &&
      ((input.facilityGroupId &&
        facility &&
        facility.facilityGroupId !== input.facilityGroupId) ||
        (input.facilityAreaId &&
          target.facilityAreaId !== input.facilityAreaId) ||
        (input.facilityTypeId &&
          target.facilityTypeId !== input.facilityTypeId) ||
        (input.reservationMode &&
          target.reservationMode !== input.reservationMode))
    ) {
      throw new BadRequestException({
        code: 'INCONSISTENT_ANALYTICS_FILTER',
        message: 'Kombinasi filter fasilitas tidak konsisten.',
      });
    }
    const endExclusiveDate = this.addDays(input.dateTo, 1);
    return {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      startAt: this.jakartaInstant(input.dateFrom, 0, 0),
      endExclusiveAt: this.jakartaInstant(endExclusiveDate, 0, 0),
      usageDateStart: this.usageDate(input.dateFrom),
      usageDateEnd: this.usageDate(input.dateTo),
      facilityAreaId: input.facilityAreaId,
      facilityTypeId: input.facilityTypeId,
      facilityGroupId: input.facilityGroupId,
      facilityId: input.facilityId,
      reservationMode: input.reservationMode,
    };
  }

  private calculateOccupancy(
    dataset: AnalyticsDataset,
    window: AnalyticsWindow,
  ): OccupancyResult {
    const facilities = dataset.facilities.filter(
      (facility) =>
        facility.facilityGroup.reservationMode === ReservationMode.EXCLUSIVE,
    );
    const bookedByFacility = new Map<string, number>();
    for (const reservation of dataset.reservations) {
      if (
        !reservation.facilityId ||
        !INCLUDED_RESERVATION_STATUSES.has(reservation.status) ||
        !this.reservationInWindow(reservation, window)
      ) {
        continue;
      }
      bookedByFacility.set(
        reservation.facilityId,
        (bookedByFacility.get(reservation.facilityId) ?? 0) +
          this.reservationSlotCount(reservation),
      );
    }
    const slots = this.operationalSlots(window);
    const rows = facilities.map((facility) => {
      const availableSlots = slots.reduce(
        (total, slot) => total + Number(this.isOperationalAt(facility, slot)),
        0,
      );
      const bookedSlots = bookedByFacility.get(facility.id) ?? 0;
      return {
        facilityId: facility.id,
        assetCode: facility.assetCode,
        name: facility.name ?? facility.facilityGroup.name,
        facilityGroupId: facility.facilityGroup.id,
        facilityGroupName: facility.facilityGroup.name,
        facilityArea: facility.facilityGroup.facilityArea,
        facilityType: facility.facilityGroup.facilityType,
        currentStatus: facility.status,
        historicalNonactive: this.wasNonactiveInWindow(facility, window),
        bookedSlots,
        availableSlots,
        percentage: this.percent(bookedSlots, availableSlots),
      };
    });
    const bookedSlots = rows.reduce((total, row) => total + row.bookedSlots, 0);
    const availableSlots = rows.reduce(
      (total, row) => total + row.availableSlots,
      0,
    );
    return {
      bookedSlots,
      availableSlots,
      percentage: this.percent(bookedSlots, availableSlots),
      facilities: rows,
    };
  }

  private calculateEquipmentUtilization(
    dataset: AnalyticsDataset,
    window: AnalyticsWindow,
  ): EquipmentUtilizationResult {
    const groups = new Map<string, AnalyticsFacility[]>();
    for (const facility of dataset.facilities) {
      if (facility.facilityGroup.reservationMode !== ReservationMode.QUANTITY) {
        continue;
      }
      const entries = groups.get(facility.facilityGroup.id) ?? [];
      entries.push(facility);
      groups.set(facility.facilityGroup.id, entries);
    }
    const slots = this.operationalSlots(window);
    const rows = [...groups.values()].map((facilities) => {
      const group = facilities[0].facilityGroup;
      const selectedUnitIds = new Set(
        facilities.map((facility) => facility.id),
      );
      const availableUnitSlots = facilities.reduce(
        (total, facility) =>
          total +
          slots.reduce(
            (slotTotal, slot) =>
              slotTotal + Number(this.isOperationalAt(facility, slot)),
            0,
          ),
        0,
      );
      const usedUnitSlots = dataset.reservations.reduce(
        (total, reservation) => {
          if (
            reservation.facilityGroupId !== group.id ||
            !INCLUDED_RESERVATION_STATUSES.has(reservation.status) ||
            !this.reservationInWindow(reservation, window)
          ) {
            return total;
          }
          const slotsUsed = this.reservationSlotCount(reservation);
          if (dataset.filter.facilityId) {
            return (
              total +
              reservation.items.filter((item) =>
                selectedUnitIds.has(item.facilityId),
              ).length *
                slotsUsed
            );
          }
          return total + reservation.requestedQuantity * slotsUsed;
        },
        0,
      );
      return {
        facilityGroupId: group.id,
        name: group.name,
        facilityArea: group.facilityArea,
        facilityType: group.facilityType,
        currentNonactiveUnits: facilities.filter(
          (facility) => facility.status === FacilityStatus.NONACTIVE,
        ).length,
        totalUnits: facilities.length,
        historicalNonactive: facilities.some((facility) =>
          this.wasNonactiveInWindow(facility, window),
        ),
        usedUnitSlots,
        availableUnitSlots,
        percentage: this.percent(usedUnitSlots, availableUnitSlots),
      };
    });
    const usedUnitSlots = rows.reduce(
      (total, row) => total + row.usedUnitSlots,
      0,
    );
    const availableUnitSlots = rows.reduce(
      (total, row) => total + row.availableUnitSlots,
      0,
    );
    return {
      usedUnitSlots,
      availableUnitSlots,
      percentage: this.percent(usedUnitSlots, availableUnitSlots),
      facilityGroups: rows,
    };
  }

  private calculateDamageFrequency(
    dataset: AnalyticsDataset,
    window: AnalyticsWindow,
  ) {
    const reports = dataset.reports.filter(
      (report) =>
        INCLUDED_DAMAGE_REPORT_STATUSES.has(report.status) &&
        report.createdAt >= window.startAt &&
        report.createdAt < window.endExclusiveAt,
    );
    const byCategory = this.groupCount(
      reports,
      (report) => report.category,
    ).map((entry) => ({
      ...entry,
      label: CATEGORY_LABELS[entry.key as ReportCategory],
    }));
    const byStatus = this.groupCount(reports, (report) => report.status);
    const byFacility = this.groupCount(
      reports,
      (report) => report.facility.id,
      (report) => ({
        facilityId: report.facility.id,
        assetCode: report.facility.assetCode,
        name: report.facility.name ?? report.facility.facilityGroup.name,
      }),
    );
    const byArea = this.groupCount(
      reports,
      (report) => report.facility.facilityGroup.facilityArea.id,
      (report) => report.facility.facilityGroup.facilityArea,
    );
    return { total: reports.length, byCategory, byStatus, byFacility, byArea };
  }

  private operationalSlots(window: AnalyticsWindow) {
    const slots: Date[] = [];
    for (
      let date = window.dateFrom;
      date <= window.dateTo;
      date = this.addDays(date, 1)
    ) {
      if (!this.isOperationalDay(date)) {
        continue;
      }
      for (
        let minute = OPERATION_START_MINUTES;
        minute < OPERATION_END_MINUTES;
        minute += SLOT_MINUTES
      ) {
        slots.push(
          this.jakartaInstant(date, Math.floor(minute / 60), minute % 60),
        );
      }
    }
    return slots;
  }

  private isOperationalAt(facility: AnalyticsFacility, instant: Date) {
    if (facility.createdAt > instant) {
      return false;
    }
    let effectiveStatus: FacilityStatus = FacilityStatus.ACTIVE;
    for (const event of facility.statusHistory) {
      if (event.effectiveAt > instant) {
        break;
      }
      effectiveStatus = event.status;
    }
    return effectiveStatus !== FacilityStatus.NONACTIVE;
  }

  private wasNonactiveInWindow(
    facility: AnalyticsFacility,
    window: AnalyticsWindow,
  ) {
    return facility.statusHistory.some(
      (event) =>
        event.status === FacilityStatus.NONACTIVE &&
        event.effectiveAt < window.endExclusiveAt,
    );
  }

  private reservationInWindow(
    reservation: AnalyticsReservation,
    window: AnalyticsWindow,
  ) {
    const date = reservation.usageDate.toISOString().slice(0, 10);
    return date >= window.dateFrom && date <= window.dateTo;
  }

  private reservationSlotCount(reservation: AnalyticsReservation) {
    const durationMinutes =
      this.timeMinutes(reservation.endTime) -
      this.timeMinutes(reservation.startTime);
    return Math.max(0, durationMinutes / SLOT_MINUTES);
  }

  private reservationDurationHours(reservation: AnalyticsReservation) {
    return this.reservationSlotCount(reservation) * (SLOT_MINUTES / 60);
  }

  private trendWindows(
    filter: NormalizedAnalyticsFilter,
    interval: AnalyticsTrendInterval,
  ): AnalyticsWindow[] {
    if (interval === AnalyticsTrendInterval.DAY) {
      const windows: AnalyticsWindow[] = [];
      for (
        let date = filter.dateFrom;
        date <= filter.dateTo;
        date = this.addDays(date, 1)
      ) {
        windows.push(this.windowForDates(date, date));
      }
      return windows;
    }
    const windows: AnalyticsWindow[] = [];
    let cursor = `${filter.dateFrom.slice(0, 7)}-01`;
    const lastMonth = filter.dateTo.slice(0, 7);
    while (cursor.slice(0, 7) <= lastMonth) {
      const monthEnd = this.addDays(this.nextMonth(cursor), -1);
      windows.push(
        this.windowForDates(
          cursor < filter.dateFrom ? filter.dateFrom : cursor,
          monthEnd > filter.dateTo ? filter.dateTo : monthEnd,
        ),
      );
      cursor = this.nextMonth(cursor);
    }
    return windows;
  }

  private windowForDates(dateFrom: string, dateTo: string): AnalyticsWindow {
    return {
      dateFrom,
      dateTo,
      startAt: this.jakartaInstant(dateFrom, 0, 0),
      endExclusiveAt: this.jakartaInstant(this.addDays(dateTo, 1), 0, 0),
      usageDateStart: this.usageDate(dateFrom),
      usageDateEnd: this.usageDate(dateTo),
    };
  }

  private periodLabel(
    window: AnalyticsWindow,
    interval: AnalyticsTrendInterval,
  ) {
    return interval === AnalyticsTrendInterval.MONTH
      ? window.dateFrom.slice(0, 7)
      : window.dateFrom;
  }

  private withMetadata<T>(dataset: AnalyticsDataset, data: T) {
    return {
      filters: this.publicFilter(dataset.filter),
      generatedAt: dataset.generatedAt,
      ...data,
    };
  }

  private publicFilter(filter: NormalizedAnalyticsFilter) {
    return {
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      facilityAreaId: filter.facilityAreaId ?? null,
      facilityTypeId: filter.facilityTypeId ?? null,
      facilityGroupId: filter.facilityGroupId ?? null,
      facilityId: filter.facilityId ?? null,
      reservationMode: filter.reservationMode ?? null,
    };
  }

  private countByEnum<T, Value extends string>(
    records: T[],
    getValue: (record: T) => Value,
    values: readonly Value[],
  ) {
    return Object.fromEntries(
      values.map((value) => [
        value,
        records.filter((record) => getValue(record) === value).length,
      ]),
    ) as Record<Value, number>;
  }

  private groupCount<T>(
    records: T[],
    key: (record: T) => string,
    metadata?: (record: T) => Record<string, unknown>,
  ) {
    const groups = new Map<
      string,
      { count: number; metadata?: Record<string, unknown> }
    >();
    for (const record of records) {
      const groupKey = key(record);
      const group = groups.get(groupKey) ?? {
        count: 0,
        metadata: metadata?.(record),
      };
      group.count += 1;
      groups.set(groupKey, group);
    }
    return [...groups.entries()]
      .map(([key, group]) => ({ key, ...group.metadata, count: group.count }))
      .sort(
        (left, right) =>
          right.count - left.count || left.key.localeCompare(right.key),
      );
  }

  private durationStats(values: number[]) {
    if (!values.length) {
      return { count: 0, average: null, median: null };
    }
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
    return {
      count: values.length,
      average: this.round(
        values.reduce((total, value) => total + value, 0) / values.length,
      ),
      median: this.round(median),
    };
  }

  private percent(numerator: number, denominator: number) {
    return denominator > 0 ? this.round((numerator / denominator) * 100) : null;
  }

  private hoursBetween(start: Date, end: Date) {
    return (end.getTime() - start.getTime()) / (60 * 60 * 1000);
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  private timeMinutes(value: Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  private parseDate(value: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException({
        code: 'INVALID_ANALYTICS_DATE',
        message: 'Tanggal analytics tidak valid.',
      });
    }
    return value;
  }

  private daysBetween(start: string, end: string) {
    return Math.round(
      (this.usageDate(end).getTime() - this.usageDate(start).getTime()) /
        (24 * 60 * 60 * 1000),
    );
  }

  private usageDate(date: string) {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private jakartaInstant(date: string, hour: number, minute: number) {
    return new Date(
      `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000${JAKARTA_OFFSET}`,
    );
  }

  private addDays(date: string, days: number) {
    const value = this.usageDate(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  private nextMonth(date: string) {
    const value = this.usageDate(date);
    value.setUTCMonth(value.getUTCMonth() + 1);
    return `${value.toISOString().slice(0, 7)}-01`;
  }

  private isOperationalDay(date: string) {
    const day = this.usageDate(date).getUTCDay();
    return day >= 1 && day <= 5;
  }
}
