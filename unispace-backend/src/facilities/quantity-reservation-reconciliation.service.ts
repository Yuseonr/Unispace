import { Injectable } from '@nestjs/common';
import {
  FacilityStatus,
  Prisma,
  ReservationStatus,
} from '../generated/prisma/client';
import { formatToJakartaDateString } from '../reservations/utils/reservation-time.util';

type ReadClient = Pick<
  Prisma.TransactionClient,
  'facility' | 'maintenancePeriod' | 'reservation'
>;

type ReconciliationClient = ReadClient &
  Pick<Prisma.TransactionClient, '$executeRaw' | 'auditLog'>;

type MaintenanceOverride = {
  facilityId: string;
  startAt: Date;
  endAt: Date;
};

type QuantityReconciliationParams = {
  facilityGroupId: string;
  usageDate: Date;
  additionalMaintenance?: MaintenanceOverride;
  excludedApprovedReservationIds?: ReadonlySet<string>;
  overlapWindow?: { startAt: Date; endAt: Date };
};

type RejectParams = QuantityReconciliationParams & {
  actorId: string;
  processedById?: string | null;
  decidedAt: Date;
  reason: string;
  metadata?: Prisma.InputJsonObject;
  auditAction?: 'RESERVATION_REJECTED' | 'RESERVATION_AUTO_REJECTED';
};

export type InfeasibleQuantityReservation = {
  id: string;
  usageDate: Date;
  startTime: Date;
  endTime: Date;
  requestedQuantity: number;
};

export type ReconcileQuantityResult = {
  rejectedReservationIds: string[];
};

/**
 * Menyatukan lock dan aturan stok alat yang dipakai oleh approval, deaktivasi,
 * dan pembuatan maintenance. Semua pemanggil memberinya transaction client
 * agar pembacaan kapasitas dan perubahan status berada pada transaksi yang sama.
 */
@Injectable()
export class QuantityReservationReconciliationService {
  async lockAvailabilityDate(
    transaction: Pick<Prisma.TransactionClient, '$executeRaw'>,
    scope: 'FACILITY' | 'FACILITY_GROUP',
    scopeId: string,
    usageDate: Date,
  ) {
    const dateKey = formatToJakartaDateString(usageDate);
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${`reservation:${scope}:${scopeId}`}),
        hashtext(${dateKey})
      )
    `;
  }

  async lockAvailabilityWindow(
    transaction: Pick<Prisma.TransactionClient, '$executeRaw'>,
    scope: 'FACILITY' | 'FACILITY_GROUP',
    scopeId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const current = this.atJakartaNoon(startAt);
    const last = this.atJakartaNoon(endAt);

    while (current <= last) {
      await this.lockAvailabilityDate(transaction, scope, scopeId, current);
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  async findInfeasibleQuantityReservations(
    transaction: ReadClient,
    params: QuantityReconciliationParams,
  ): Promise<InfeasibleQuantityReservation[]> {
    const facilities = await transaction.facility.findMany({
      where: {
        facilityGroupId: params.facilityGroupId,
        status: { not: FacilityStatus.NONACTIVE },
      },
      select: { id: true },
    });

    const pendingReservations = await transaction.reservation.findMany({
      where: {
        facilityGroupId: params.facilityGroupId,
        usageDate: params.usageDate,
        status: ReservationStatus.PENDING,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        requestedQuantity: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const relevantPendingReservations = pendingReservations.filter(
      (pending) => {
        if (!params.overlapWindow) {
          return true;
        }
        const startAt = this.reservationInstant(
          params.usageDate,
          this.timeMinutes(pending.startTime),
        );
        const endAt = this.reservationInstant(
          params.usageDate,
          this.timeMinutes(pending.endTime),
        );
        return (
          startAt < params.overlapWindow.endAt &&
          endAt > params.overlapWindow.startAt
        );
      },
    );

    if (relevantPendingReservations.length === 0) {
      return [];
    }

    const activeFacilityIds = facilities.map((facility) => facility.id);
    const [approvedReservations, existingMaintenance] = await Promise.all([
      transaction.reservation.findMany({
        where: {
          facilityGroupId: params.facilityGroupId,
          usageDate: params.usageDate,
          status: ReservationStatus.APPROVED,
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          requestedQuantity: true,
        },
      }),
      activeFacilityIds.length === 0
        ? []
        : transaction.maintenancePeriod.findMany({
            where: {
              facilityId: { in: activeFacilityIds },
              startAt: { lt: this.dayEndUtc(params.usageDate) },
              endAt: { gt: this.dayStartUtc(params.usageDate) },
            },
            select: { facilityId: true, startAt: true, endAt: true },
          }),
    ]);

    const excludedApproved =
      params.excludedApprovedReservationIds ?? new Set<string>();
    const infeasible: InfeasibleQuantityReservation[] = [];

    for (const pending of relevantPendingReservations) {
      const pendingStart = this.timeMinutes(pending.startTime);
      const pendingEnd = this.timeMinutes(pending.endTime);
      let insufficient = false;

      for (let minute = pendingStart; minute < pendingEnd; minute += 30) {
        const slotStartTime = this.timeAtEpoch(minute);
        const slotEndTime = this.timeAtEpoch(minute + 30);
        const slotStartAt = this.reservationInstant(params.usageDate, minute);
        const slotEndAt = this.reservationInstant(
          params.usageDate,
          minute + 30,
        );

        const maintenanceUnitIds = new Set(
          existingMaintenance
            .filter(
              (period) =>
                period.startAt < slotEndAt && period.endAt > slotStartAt,
            )
            .map((period) => period.facilityId),
        );
        if (
          params.additionalMaintenance &&
          params.additionalMaintenance.startAt < slotEndAt &&
          params.additionalMaintenance.endAt > slotStartAt
        ) {
          maintenanceUnitIds.add(params.additionalMaintenance.facilityId);
        }

        const reservedQuantity = approvedReservations
          .filter(
            (reservation) =>
              !excludedApproved.has(reservation.id) &&
              reservation.startTime < slotEndTime &&
              reservation.endTime > slotStartTime,
          )
          .reduce((sum, reservation) => sum + reservation.requestedQuantity, 0);

        const availableQuantity = Math.max(
          0,
          facilities.length - maintenanceUnitIds.size - reservedQuantity,
        );
        if (availableQuantity < pending.requestedQuantity) {
          insufficient = true;
          break;
        }
      }

      if (insufficient) {
        infeasible.push({ ...pending, usageDate: params.usageDate });
      }
    }

    return infeasible;
  }

  async rejectInfeasibleQuantityReservations(
    transaction: ReconciliationClient,
    params: RejectParams,
  ): Promise<ReconcileQuantityResult> {
    const infeasible = await this.findInfeasibleQuantityReservations(
      transaction,
      params,
    );
    const rejectedReservationIds: string[] = [];

    for (const pending of infeasible) {
      const changed = await transaction.reservation.updateMany({
        where: { id: pending.id, status: ReservationStatus.PENDING },
        data: {
          status: ReservationStatus.REJECTED,
          processedById: params.processedById ?? params.actorId,
          decidedAt: params.decidedAt,
          decisionReason: params.reason.trim(),
        },
      });

      if (changed.count !== 1) {
        continue;
      }

      rejectedReservationIds.push(pending.id);
      await transaction.auditLog.create({
        data: {
          actorId: params.actorId,
          action: params.auditAction ?? 'RESERVATION_AUTO_REJECTED',
          entityType: 'RESERVATION',
          entityId: pending.id,
          metadata: {
            ...params.metadata,
            rejectionSource: 'FACILITY_AVAILABILITY_RECONCILIATION',
            requestedQuantity: pending.requestedQuantity,
            usageDate: formatToJakartaDateString(params.usageDate),
          },
        },
      });
    }

    return { rejectedReservationIds };
  }

  async rejectExclusiveReservations(
    transaction: Pick<Prisma.TransactionClient, 'reservation' | 'auditLog'>,
    params: {
      facilityId: string;
      startAt?: Date;
      endAt?: Date;
      actorId: string;
      processedById?: string | null;
      decidedAt: Date;
      reason: string;
      metadata?: Prisma.InputJsonObject;
    },
  ) {
    const pendingReservations = await transaction.reservation.findMany({
      where: {
        facilityId: params.facilityId,
        status: ReservationStatus.PENDING,
      },
      select: {
        id: true,
        usageDate: true,
        startTime: true,
        endTime: true,
      },
    });
    const rejectedReservationIds: string[] = [];

    for (const reservation of pendingReservations) {
      const overlaps =
        !params.startAt ||
        !params.endAt ||
        (this.reservationInstant(
          reservation.usageDate,
          this.timeMinutes(reservation.startTime),
        ) < params.endAt &&
          this.reservationInstant(
            reservation.usageDate,
            this.timeMinutes(reservation.endTime),
          ) > params.startAt);

      if (!overlaps) {
        continue;
      }

      const changed = await transaction.reservation.updateMany({
        where: { id: reservation.id, status: ReservationStatus.PENDING },
        data: {
          status: ReservationStatus.REJECTED,
          processedById: params.processedById ?? params.actorId,
          decidedAt: params.decidedAt,
          decisionReason: params.reason.trim(),
        },
      });
      if (changed.count !== 1) {
        continue;
      }

      rejectedReservationIds.push(reservation.id);
      await transaction.auditLog.create({
        data: {
          actorId: params.actorId,
          action: 'RESERVATION_AUTO_REJECTED',
          entityType: 'RESERVATION',
          entityId: reservation.id,
          metadata: {
            ...params.metadata,
            rejectionSource: 'FACILITY_AVAILABILITY_RECONCILIATION',
          },
        },
      });
    }

    return { rejectedReservationIds };
  }

  private timeMinutes(value: Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  private timeAtEpoch(minutes: number) {
    return new Date(Date.UTC(1970, 0, 1, 0, minutes, 0));
  }

  private reservationInstant(usageDate: Date, minutes: number) {
    const date = formatToJakartaDateString(usageDate);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return new Date(
      `${date}T${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}:00.000+07:00`,
    );
  }

  private atJakartaNoon(value: Date) {
    const date = formatToJakartaDateString(value);
    return new Date(`${date}T12:00:00.000Z`);
  }

  private dayStartUtc(value: Date) {
    const date = formatToJakartaDateString(value);
    return new Date(`${date}T00:00:00.000+07:00`);
  }

  private dayEndUtc(value: Date) {
    const date = formatToJakartaDateString(value);
    const next = new Date(`${date}T00:00:00.000+07:00`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
}
