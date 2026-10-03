import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QuantityReservationReconciliationService } from './quantity-reservation-reconciliation.service';
import { CreateDirectMaintenanceDto } from './dto/create-direct-maintenance.dto';
import { FacilityStatus, ReservationMode, ReservationStatus, Prisma } from '../generated/prisma/client';
import { MaintenanceMode } from '../reports/reports.constants';
import { formatToJakartaDateString } from '../reservations/utils/reservation-time.util';

@Injectable()
export class StaffMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: QuantityReservationReconciliationService,
  ) {}

  async previewDirectMaintenance(facilityId: string, input: CreateDirectMaintenanceDto) {
    const { dateStart, dateEnd } = this.maintenanceDates(input);
    return this.prisma.$transaction(async (tx) => {
      const facility = await tx.facility.findUnique({
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
          message: 'Facility not found.',
        });
      }
      if (facility.status === FacilityStatus.NONACTIVE) {
        throw new ConflictException({
          code: 'FACILITY_NOT_ACTIVE',
          message: 'Maintenance cannot be scheduled for a nonactive facility.',
        });
      }

      const scope = facility.facilityGroup.reservationMode === ReservationMode.QUANTITY ? 'FACILITY_GROUP' : 'FACILITY';
      const scopeId = scope === 'FACILITY_GROUP' ? facility.facilityGroupId : facility.id;
      
      await this.reconciliation.lockAvailabilityWindow(tx, scope, scopeId, dateStart, dateEnd);

      return {
        facilityId,
        ...(await this.getMaintenanceImpact(facilityId, dateStart, dateEnd, tx)),
      };
    });
  }

  async createDirectMaintenance(staffId: string, facilityId: string, input: CreateDirectMaintenanceDto) {
    const { dateStart, dateEnd } = this.maintenanceDates(input);

    if (!input.cancelImpactedReservations) {
      throw new ConflictException({
        code: 'MAINTENANCE_CONFIRMATION_REQUIRED',
        message: 'Maintenance impact must be confirmed before the period is created.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const facility = await tx.facility.findUnique({
        where: { id: facilityId },
        select: {
          id: true,
          status: true,
          facilityGroupId: true,
          facilityGroup: { select: { reservationMode: true } },
        },
      });

      if (!facility) throw new NotFoundException({ code: 'FACILITY_NOT_FOUND', message: 'Facility not found.' });

      const scope = facility.facilityGroup.reservationMode === ReservationMode.QUANTITY ? 'FACILITY_GROUP' : 'FACILITY';
      const scopeId = scope === 'FACILITY_GROUP' ? facility.facilityGroupId : facility.id;
      
      await this.reconciliation.lockAvailabilityWindow(tx, scope, scopeId, dateStart, dateEnd);

      const impact = await this.getMaintenanceImpact(facilityId, dateStart, dateEnd, tx);
      const now = new Date();
      const reason = input.cancellationReason?.trim() || 'Fasilitas ditutup untuk perbaikan';

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: 'DIRECT_MAINTENANCE_CREATED',
          entityType: 'FACILITY',
          entityId: facilityId,
          metadata: {
            startAt: dateStart.toISOString(),
            endAt: dateEnd.toISOString(),
            reason,
          },
        },
      });

      if (impact.pendingReservations.length > 0) {
        await tx.reservation.updateMany({
          where: { id: { in: impact.pendingReservations.map(r => r.id) } },
          data: {
            status: ReservationStatus.REJECTED,
            processedById: staffId,
            decidedAt: now,
            decisionReason: reason,
          },
        });
      }

      if (impact.approvedReservations.length > 0) {
        await tx.reservation.updateMany({
          where: { id: { in: impact.approvedReservations.map(r => r.id) } },
          data: {
            status: ReservationStatus.CANCELLED_BY_STAFF,
            processedById: staffId,
            decidedAt: now,
            decisionReason: reason,
          },
        });
      }

      return tx.maintenancePeriod.create({
        data: {
          facilityId,
          startAt: dateStart,
          endAt: dateEnd,
          note: input.note,
        },
      });
    });
  }

  private maintenanceDates(input: CreateDirectMaintenanceDto) {
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

  private async getMaintenanceImpact(
    facilityId: string,
    startAt: Date,
    endAt: Date,
    client: Pick<Prisma.TransactionClient, 'facility' | 'reservation' | 'maintenancePeriod' | 'auditLog'>,
  ) {
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

    if (!facility) throw new NotFoundException('Facility not found');
    
    const usageDate = {
      gte: this.usageDateStartUtc(startAt),
      lte: this.usageDateStartUtc(endAt),
    };
    
    const isQuantity = facility.facilityGroup.reservationMode === ReservationMode.QUANTITY;
    const approvedWhere: Prisma.ReservationWhereInput = isQuantity
      ? { facilityGroupId: facility.facilityGroupId, items: { some: { facilityId } }, status: ReservationStatus.APPROVED, usageDate }
      : { facilityId, status: ReservationStatus.APPROVED, usageDate };
    const pendingWhere: Prisma.ReservationWhereInput = isQuantity
      ? { facilityGroupId: facility.facilityGroupId, status: ReservationStatus.PENDING, usageDate }
      : { facilityId, status: ReservationStatus.PENDING, usageDate };
      
    const reservationSelect = {
      id: true,
      usageDate: true,
      startTime: true,
      endTime: true,
      requestedQuantity: true,
    } satisfies Prisma.ReservationSelect;
    
    const [approved, pending] = await Promise.all([
      client.reservation.findMany({ where: approvedWhere, select: reservationSelect }),
      client.reservation.findMany({ where: pendingWhere, select: reservationSelect }),
    ]);

    const approvedReservations = approved
      .filter((reservation) => this.reservationOverlapsWindow(reservation, startAt, endAt))
      .map((reservation) => ({
        id: reservation.id,
        usageDate: reservation.usageDate.toISOString(),
        startTime: reservation.startTime.toISOString(),
        endTime: reservation.endTime.toISOString(),
      }));

    let pendingReservations: Array<{id: string, usageDate: string, startTime: string, endTime: string, requestedQuantity: number}> = [];
    if (!isQuantity) {
      pendingReservations = pending
        .filter((reservation) => this.reservationOverlapsWindow(reservation, startAt, endAt))
        .map((reservation) => ({
          id: reservation.id,
          usageDate: reservation.usageDate.toISOString(),
          startTime: reservation.startTime.toISOString(),
          endTime: reservation.endTime.toISOString(),
          requestedQuantity: reservation.requestedQuantity,
        }));
    } else {
      const excludedApproved = new Set(approvedReservations.map((r) => r.id));
      const seen = new Set<string>();
      for (const reservation of pending) {
        const dateKey = formatToJakartaDateString(reservation.usageDate);
        if (seen.has(dateKey)) continue;
        seen.add(dateKey);
        
        const infeasible = await this.reconciliation.findInfeasibleQuantityReservations(client, {
          facilityGroupId: facility.facilityGroupId,
          usageDate: reservation.usageDate,
          additionalMaintenance: { facilityId, startAt, endAt },
          excludedApprovedReservationIds: excludedApproved,
          overlapWindow: { startAt, endAt },
        });
        
        pendingReservations.push(...infeasible.map((item) => ({
          id: item.id,
          usageDate: item.usageDate.toISOString(),
          startTime: item.startTime.toISOString(),
          endTime: item.endTime.toISOString(),
          requestedQuantity: item.requestedQuantity,
        })));
      }
    }

    return { approvedReservations, pendingReservations };
  }

  private reservationOverlapsWindow(
    reservation: { usageDate: Date; startTime: Date; endTime: Date },
    windowStart: Date,
    windowEnd: Date,
  ) {
    const startAt = this.reservationInstant(reservation.usageDate, this.timeMinutes(reservation.startTime));
    const endAt = this.reservationInstant(reservation.usageDate, this.timeMinutes(reservation.endTime));
    return startAt < windowEnd && endAt > windowStart;
  }

  private usageDateStartUtc(value: Date) {
    const date = new Date(value);
    date.setUTCHours(date.getUTCHours() + 7);
    const dateStr = date.toISOString().split('T')[0];
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  private timeMinutes(value: Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  private reservationInstant(usageDate: Date, minutes: number) {
    const date = formatToJakartaDateString(usageDate);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return new Date(`${date}T${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}:00.000+07:00`);
  }
}
