import { Injectable, NotFoundException } from '@nestjs/common';
import { FacilityStatus, ReservationMode } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QueryAvailabilityDto } from '../dto/catalog';
import {
  FACILITY_SLOT_COUNT,
  facilitySlotTime,
} from '../utils/availability-slot.util';

/** Kalkulasi read-only ketersediaan slot 30 menit untuk publik. */
@Injectable()
export class FacilityAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(id: string, query: QueryAvailabilityDto) {
    const { date, kind = 'unit' } = query;
    const [year, month, day] = date.split('-').map(Number);
    const checkDate = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
    const dayOfWeek = checkDate.getUTCDay();
    const isOperationalDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    const usageDate = new Date(Date.UTC(year, month - 1, day));
    const dayStartUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayEndUtc = new Date(Date.UTC(year, month - 1, day, 13, 0, 0));

    if (kind === 'group') {
      return this.getQuantityAvailability(
        id,
        date,
        usageDate,
        dayStartUtc,
        dayEndUtc,
        year,
        month,
        day,
        isOperationalDay,
      );
    }
    return this.getExclusiveAvailability(
      id,
      date,
      usageDate,
      dayStartUtc,
      dayEndUtc,
      year,
      month,
      day,
      isOperationalDay,
    );
  }

  private async getQuantityAvailability(
    id: string,
    date: string,
    usageDate: Date,
    dayStartUtc: Date,
    dayEndUtc: Date,
    year: number,
    month: number,
    day: number,
    isOperationalDay: boolean,
  ) {
    const group = await this.prisma.facilityGroup.findFirst({
      where: {
        id,
        reservationMode: ReservationMode.QUANTITY,
        facilities: { some: { status: FacilityStatus.ACTIVE } },
      },
      include: {
        facilities: {
          where: { status: FacilityStatus.ACTIVE },
          select: { id: true, assetCode: true },
        },
      },
    });
    if (!group) {
      throw new NotFoundException('Kelompok fasilitas tidak ditemukan.');
    }

    const activeUnitIds = group.facilities.map((facility) => facility.id);
    const [approvedReservations, maintenancePeriods] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { facilityGroupId: id, usageDate, status: 'APPROVED' },
        select: { startTime: true, endTime: true, requestedQuantity: true },
      }),
      activeUnitIds.length > 0
        ? this.prisma.maintenancePeriod.findMany({
            where: {
              facilityId: { in: activeUnitIds },
              startAt: { lt: dayEndUtc },
              endAt: { gt: dayStartUtc },
            },
            select: { facilityId: true, startAt: true, endAt: true },
          })
        : [],
    ]);
    const activeUnitsCount = group.facilities.length;
    const slots = Array.from({ length: FACILITY_SLOT_COUNT }, (_, index) => {
      const slot = facilitySlotTime(index);
      if (!isOperationalDay) {
        return {
          slotIndex: index,
          startTime: slot.startTime,
          endTime: slot.endTime,
          available: false,
          availableUnits: 0,
          totalUnits: activeUnitsCount,
          reason: 'NON_OPERATIONAL_DAY',
        };
      }

      const slotStartUtc = new Date(
        Date.UTC(year, month - 1, day, slot.startHour - 7, slot.startMinute),
      );
      const slotEndUtc = new Date(
        Date.UTC(year, month - 1, day, slot.endHour - 7, slot.endMinute),
      );
      const slotStartTime = new Date(
        Date.UTC(1970, 0, 1, slot.startHour, slot.startMinute),
      );
      const slotEndTime = new Date(
        Date.UTC(1970, 0, 1, slot.endHour, slot.endMinute),
      );
      const maintenanceUnitIds = new Set(
        maintenancePeriods
          .filter(
            (period) =>
              period.startAt < slotEndUtc && period.endAt > slotStartUtc,
          )
          .map((period) => period.facilityId),
      );
      const maintenanceCount = maintenanceUnitIds.size;
      const reservedCount = approvedReservations
        .filter(
          (reservation) =>
            reservation.startTime < slotEndTime &&
            reservation.endTime > slotStartTime,
        )
        .reduce((sum, reservation) => sum + reservation.requestedQuantity, 0);
      const availableUnits = Math.max(
        0,
        activeUnitsCount - maintenanceCount - reservedCount,
      );

      return {
        slotIndex: index,
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: availableUnits > 0,
        availableUnits,
        totalUnits: activeUnitsCount,
        reason:
          availableUnits > 0
            ? undefined
            : maintenanceCount > 0
              ? 'MAINTENANCE'
              : 'OUT_OF_STOCK',
      };
    });

    return {
      kind: 'QUANTITY' as const,
      facilityGroupId: group.id,
      name: group.name,
      date,
      isOperationalDay,
      totalActiveUnits: activeUnitsCount,
      slots,
    };
  }

  private async getExclusiveAvailability(
    id: string,
    date: string,
    usageDate: Date,
    dayStartUtc: Date,
    dayEndUtc: Date,
    year: number,
    month: number,
    day: number,
    isOperationalDay: boolean,
  ) {
    const facility = await this.prisma.facility.findFirst({
      where: {
        id,
        status: FacilityStatus.ACTIVE,
        facilityGroup: { reservationMode: ReservationMode.EXCLUSIVE },
      },
      select: {
        id: true,
        assetCode: true,
        name: true,
        facilityGroup: { select: { name: true } },
      },
    });
    if (!facility) {
      throw new NotFoundException('Fasilitas tidak ditemukan.');
    }

    const [approvedReservations, maintenancePeriods] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { facilityId: id, usageDate, status: 'APPROVED' },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.maintenancePeriod.findMany({
        where: {
          facilityId: id,
          startAt: { lt: dayEndUtc },
          endAt: { gt: dayStartUtc },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);
    const slots = Array.from({ length: FACILITY_SLOT_COUNT }, (_, index) => {
      const slot = facilitySlotTime(index);
      if (!isOperationalDay) {
        return {
          slotIndex: index,
          startTime: slot.startTime,
          endTime: slot.endTime,
          available: false,
          reason: 'NON_OPERATIONAL_DAY',
        };
      }

      const slotStartUtc = new Date(
        Date.UTC(year, month - 1, day, slot.startHour - 7, slot.startMinute),
      );
      const slotEndUtc = new Date(
        Date.UTC(year, month - 1, day, slot.endHour - 7, slot.endMinute),
      );
      const slotStartTime = new Date(
        Date.UTC(1970, 0, 1, slot.startHour, slot.startMinute),
      );
      const slotEndTime = new Date(
        Date.UTC(1970, 0, 1, slot.endHour, slot.endMinute),
      );
      if (
        maintenancePeriods.some(
          (period) =>
            period.startAt < slotEndUtc && period.endAt > slotStartUtc,
        )
      ) {
        return {
          slotIndex: index,
          startTime: slot.startTime,
          endTime: slot.endTime,
          available: false,
          reason: 'MAINTENANCE',
        };
      }
      if (
        approvedReservations.some(
          (reservation) =>
            reservation.startTime < slotEndTime &&
            reservation.endTime > slotStartTime,
        )
      ) {
        return {
          slotIndex: index,
          startTime: slot.startTime,
          endTime: slot.endTime,
          available: false,
          reason: 'RESERVED',
        };
      }
      return {
        slotIndex: index,
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: true,
      };
    });

    return {
      kind: 'EXCLUSIVE' as const,
      facilityId: facility.id,
      assetCode: facility.assetCode,
      name: facility.name ?? facility.facilityGroup.name,
      date,
      isOperationalDay,
      slots,
    };
  }
}
