import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FacilityStatus,
  Prisma,
  ReservationMode,
  ReservationStatus,
} from '../generated/prisma/client';
import { formatToJakartaDateString } from '../reservations/utils/reservation-time.util';
import { MaintenanceMode } from './maintenance.constants';
import { QuantityReservationReconciliationService } from './quantity-reservation-reconciliation.service';

export type MaintenanceWindowInput = {
  mode: MaintenanceMode;
  startDate?: string;
  endDate?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

export type MaintenanceImpact = {
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

export type PreparedMaintenance = {
  facilityId: string;
  facilityGroupId: string;
  isQuantity: boolean;
  impact: MaintenanceImpact;
};

type ImpactSource = {
  kind: 'DIRECT_MAINTENANCE' | 'REPORT_MAINTENANCE';
  reportId?: string;
};

/**
 * Applies the business rules shared by report-originated and direct maintenance.
 * Callers keep ownership of their parent resource (report or direct period), while
 * this service keeps availability locking and reservation mutations consistent.
 */
@Injectable()
export class MaintenanceWorkflowService {
  constructor(
    private readonly reconciliation: QuantityReservationReconciliationService,
  ) {}

  dates(input: MaintenanceWindowInput, now: Date = new Date()) {
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
    if (dateStart < now) {
      throw new ConflictException({
        code: 'MAINTENANCE_PERIOD_IN_PAST',
        message: 'Maintenance must start now or be scheduled for the future.',
      });
    }

    return { dateStart, dateEnd };
  }

  async prepare(
    transaction: Prisma.TransactionClient,
    facilityId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<PreparedMaintenance> {
    const facility = await transaction.facility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        status: true,
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
    if (facility.status === FacilityStatus.NONACTIVE) {
      throw new ConflictException({
        code: 'FACILITY_NOT_ACTIVE',
        message: 'Maintenance cannot be scheduled for a nonactive facility.',
      });
    }

    const isQuantity =
      facility.facilityGroup.reservationMode === ReservationMode.QUANTITY;
    await this.reconciliation.lockAvailabilityWindow(
      transaction,
      isQuantity ? 'FACILITY_GROUP' : 'FACILITY',
      isQuantity ? facility.facilityGroupId : facility.id,
      startAt,
      endAt,
    );

    return {
      facilityId: facility.id,
      facilityGroupId: facility.facilityGroupId,
      isQuantity,
      impact: await this.getImpact(
        transaction,
        facility.id,
        facility.facilityGroupId,
        isQuantity,
        startAt,
        endAt,
      ),
    };
  }

  async applyReservationImpact(
    transaction: Prisma.TransactionClient,
    params: {
      prepared: PreparedMaintenance;
      startAt: Date;
      endAt: Date;
      staffId: string;
      reason: string;
      now: Date;
      source: ImpactSource;
    },
  ) {
    let approvedCancelled = 0;
    for (const reservation of params.prepared.impact.approvedReservations) {
      const changed = await transaction.reservation.updateMany({
        where: { id: reservation.id, status: ReservationStatus.APPROVED },
        data: {
          status: ReservationStatus.CANCELLED_BY_STAFF,
          processedById: params.staffId,
          decidedAt: params.now,
          cancelledAt: params.now,
          decisionReason: params.reason,
        },
      });

      if (changed.count !== 1) {
        continue;
      }

      approvedCancelled++;
      await transaction.auditLog.create({
        data: {
          actorId: params.staffId,
          action: 'RESERVATION_CANCELLED_BY_STAFF',
          entityType: 'RESERVATION',
          entityId: reservation.id,
          metadata: {
            reason: params.reason,
            cancellationSource: 'MAINTENANCE_PERIOD',
            maintenanceSource: params.source.kind,
            reportId: params.source.reportId,
            facilityId: params.prepared.facilityId,
          },
        },
      });
    }

    let pendingRejected = 0;
    const metadata = {
      facilityId: params.prepared.facilityId,
      maintenanceSource: params.source.kind,
      reportId: params.source.reportId,
      rejectionSource: 'MAINTENANCE_PERIOD',
    } satisfies Prisma.InputJsonObject;

    if (params.prepared.isQuantity) {
      const pendingDates = await transaction.reservation.findMany({
        where: {
          facilityGroupId: params.prepared.facilityGroupId,
          status: ReservationStatus.PENDING,
          usageDate: {
            gte: this.usageDateStartUtc(params.startAt),
            lte: this.usageDateStartUtc(params.endAt),
          },
        },
        select: { usageDate: true },
        distinct: ['usageDate'],
      });

      for (const pendingDate of pendingDates) {
        const result =
          await this.reconciliation.rejectInfeasibleQuantityReservations(
            transaction,
            {
              facilityGroupId: params.prepared.facilityGroupId,
              usageDate: pendingDate.usageDate,
              additionalMaintenance: {
                facilityId: params.prepared.facilityId,
                startAt: params.startAt,
                endAt: params.endAt,
              },
              actorId: params.staffId,
              processedById: params.staffId,
              decidedAt: params.now,
              reason: params.reason,
              metadata,
            },
          );
        pendingRejected += result.rejectedReservationIds.length;
      }
    } else {
      const result = await this.reconciliation.rejectExclusiveReservations(
        transaction,
        {
          facilityId: params.prepared.facilityId,
          startAt: params.startAt,
          endAt: params.endAt,
          actorId: params.staffId,
          processedById: params.staffId,
          decidedAt: params.now,
          reason: params.reason,
          metadata,
        },
      );
      pendingRejected = result.rejectedReservationIds.length;
    }

    return { approvedCancelled, pendingRejected };
  }

  private async getImpact(
    transaction: Prisma.TransactionClient,
    facilityId: string,
    facilityGroupId: string,
    isQuantity: boolean,
    startAt: Date,
    endAt: Date,
  ): Promise<MaintenanceImpact> {
    const usageDate = {
      gte: this.usageDateStartUtc(startAt),
      lte: this.usageDateStartUtc(endAt),
    };
    const approvedWhere: Prisma.ReservationWhereInput = isQuantity
      ? {
          facilityGroupId,
          items: { some: { facilityId } },
          status: ReservationStatus.APPROVED,
          usageDate,
        }
      : { facilityId, status: ReservationStatus.APPROVED, usageDate };
    const pendingWhere: Prisma.ReservationWhereInput = isQuantity
      ? { facilityGroupId, status: ReservationStatus.PENDING, usageDate }
      : { facilityId, status: ReservationStatus.PENDING, usageDate };
    const reservationSelect = {
      id: true,
      usageDate: true,
      startTime: true,
      endTime: true,
      requestedQuantity: true,
    } satisfies Prisma.ReservationSelect;
    const [approved, pending] = await Promise.all([
      transaction.reservation.findMany({
        where: approvedWhere,
        select: reservationSelect,
      }),
      transaction.reservation.findMany({
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
          await this.reconciliation.findInfeasibleQuantityReservations(
            transaction,
            {
              facilityGroupId,
              usageDate: reservation.usageDate,
              additionalMaintenance: { facilityId, startAt, endAt },
              excludedApprovedReservationIds: excludedApproved,
              overlapWindow: { startAt, endAt },
            },
          );
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

    return { facilityId, approvedReservations, pendingReservations };
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
}
