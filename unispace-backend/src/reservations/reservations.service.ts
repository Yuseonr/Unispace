import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FacilityStatus,
  ReservationMode,
  ReservationStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { GetAvailabilityDto } from './dto/get-availability.dto';
import { isOperationalDay } from './utils/reservation-time.util';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mengembalikan daftar 26 slot 30 menit (07.00–20.00 WIB) untuk tanggal yang diminta.
   * Terbuka untuk umum tanpa mengekspos data pribadi pemesan.
   */
  async getAvailability(dto: GetAvailabilityDto) {
    const { facilityId, facilityGroupId, usageDate } = dto;

    if ((!facilityId && !facilityGroupId) || (facilityId && facilityGroupId)) {
      throw new BadRequestException(
        'Pilih salah satu: facilityId (ruang eksklusif) atau facilityGroupId (kelompok alat).',
      );
    }

    const [year, month, day] = usageDate.split('-').map(Number);
    const usageDateObj = new Date(Date.UTC(year, month - 1, day));
    const isOperDay = isOperationalDay(usageDate);

    // Rentang satu hari penuh (07.00 - 20.00 WIB => UTC 00.00 - 13.00)
    const dayStartUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayEndUtc = new Date(Date.UTC(year, month - 1, day, 13, 0, 0));

    // A. Mode Ruang Eksklusif
    if (facilityId) {
      const facility = await this.prisma.facility.findUnique({
        where: { id: facilityId },
        include: {
          facilityGroup: {
            select: { id: true, name: true, reservationMode: true },
          },
        },
      });

      if (!facility) {
        throw new NotFoundException('Fasilitas tidak ditemukan.');
      }
      if (
        facility.facilityGroup.reservationMode !== ReservationMode.EXCLUSIVE
      ) {
        throw new BadRequestException(
          'Fasilitas ini bukan untuk mode peminjaman eksklusif.',
        );
      }

      const isFacilityActive = facility.status === FacilityStatus.ACTIVE;

      const [approvedReservations, maintenancePeriods] = await Promise.all([
        this.prisma.reservation.findMany({
          where: {
            facilityId,
            usageDate: usageDateObj,
            status: ReservationStatus.APPROVED,
          },
          select: { startTime: true, endTime: true },
        }),
        this.prisma.maintenancePeriod.findMany({
          where: {
            facilityId,
            startAt: { lt: dayEndUtc },
            endAt: { gt: dayStartUtc },
          },
          select: { startAt: true, endAt: true },
        }),
      ]);

      const slots = Array.from({ length: 26 }, (_, i) => {
        const startHour = 7 + Math.floor(i / 2);
        const startMin = (i % 2) * 30;
        const endHour = 7 + Math.floor((i + 1) / 2);
        const endMin = ((i + 1) % 2) * 30;

        const pad = (n: number) => n.toString().padStart(2, '0');
        const startTimeStr = `${pad(startHour)}:${pad(startMin)}`;
        const endTimeStr = `${pad(endHour)}:${pad(endMin)}`;

        if (!isOperDay) {
          return {
            slotIndex: i,
            startTime: startTimeStr,
            endTime: endTimeStr,
            available: false,
            reason: 'NON_OPERATIONAL_DAY',
          };
        }

        if (!isFacilityActive) {
          return {
            slotIndex: i,
            startTime: startTimeStr,
            endTime: endTimeStr,
            available: false,
            reason: 'FACILITY_INACTIVE',
          };
        }

        const slotStartTimeDate = new Date(
          Date.UTC(1970, 0, 1, startHour, startMin, 0),
        );
        const slotEndTimeDate = new Date(
          Date.UTC(1970, 0, 1, endHour, endMin, 0),
        );
        const slotStartUtc = new Date(
          Date.UTC(year, month - 1, day, startHour - 7, startMin, 0),
        );
        const slotEndUtc = new Date(
          Date.UTC(year, month - 1, day, endHour - 7, endMin, 0),
        );

        const isUnderMaintenance = maintenancePeriods.some(
          (m) => m.startAt < slotEndUtc && m.endAt > slotStartUtc,
        );
        if (isUnderMaintenance) {
          return {
            slotIndex: i,
            startTime: startTimeStr,
            endTime: endTimeStr,
            available: false,
            reason: 'MAINTENANCE',
          };
        }

        const isBooked = approvedReservations.some(
          (r) => r.startTime < slotEndTimeDate && r.endTime > slotStartTimeDate,
        );
        if (isBooked) {
          return {
            slotIndex: i,
            startTime: startTimeStr,
            endTime: endTimeStr,
            available: false,
            reason: 'BOOKED',
          };
        }

        return {
          slotIndex: i,
          startTime: startTimeStr,
          endTime: endTimeStr,
          available: true,
        };
      });

      return {
        facilityId,
        facilityName: facility.name,
        reservationMode: ReservationMode.EXCLUSIVE,
        usageDate,
        isOperationalDay: isOperDay,
        slots,
      };
    }

    // B. Mode Kelompok Alat (QUANTITY)
    const group = await this.prisma.facilityGroup.findFirst({
      where: { id: facilityGroupId, reservationMode: ReservationMode.QUANTITY },
      include: {
        facilities: {
          where: { status: FacilityStatus.ACTIVE },
          select: { id: true, assetCode: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Kelompok alat tidak ditemukan.');
    }

    const totalActiveUnits = group.facilities.length;
    const activeUnitIds = group.facilities.map((f) => f.id);

    const [approvedReservations, maintenancePeriods] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          facilityGroupId,
          usageDate: usageDateObj,
          status: ReservationStatus.APPROVED,
        },
        select: {
          startTime: true,
          endTime: true,
          requestedQuantity: true,
        },
      }),
      activeUnitIds.length > 0
        ? this.prisma.maintenancePeriod.findMany({
            where: {
              facilityId: { in: activeUnitIds },
              startAt: { lt: dayEndUtc },
              endAt: { gt: dayStartUtc },
            },
            select: {
              facilityId: true,
              startAt: true,
              endAt: true,
            },
          })
        : [],
    ]);

    const slots = Array.from({ length: 26 }, (_, i) => {
      const startHour = 7 + Math.floor(i / 2);
      const startMin = (i % 2) * 30;
      const endHour = 7 + Math.floor((i + 1) / 2);
      const endMin = ((i + 1) % 2) * 30;

      const pad = (n: number) => n.toString().padStart(2, '0');
      const startTimeStr = `${pad(startHour)}:${pad(startMin)}`;
      const endTimeStr = `${pad(endHour)}:${pad(endMin)}`;

      if (!isOperDay) {
        return {
          slotIndex: i,
          startTime: startTimeStr,
          endTime: endTimeStr,
          available: false,
          availableUnits: 0,
          totalUnits: totalActiveUnits,
          reason: 'NON_OPERATIONAL_DAY',
        };
      }

      const slotStartTimeDate = new Date(
        Date.UTC(1970, 0, 1, startHour, startMin, 0),
      );
      const slotEndTimeDate = new Date(
        Date.UTC(1970, 0, 1, endHour, endMin, 0),
      );
      const slotStartUtc = new Date(
        Date.UTC(year, month - 1, day, startHour - 7, startMin, 0),
      );
      const slotEndUtc = new Date(
        Date.UTC(year, month - 1, day, endHour - 7, endMin, 0),
      );

      const maintenanceCount = new Set(
        maintenancePeriods
          .filter((m) => m.startAt < slotEndUtc && m.endAt > slotStartUtc)
          .map((m) => m.facilityId),
      ).size;

      const reservedCount = approvedReservations
        .filter(
          (r) => r.startTime < slotEndTimeDate && r.endTime > slotStartTimeDate,
        )
        .reduce((sum, r) => sum + r.requestedQuantity, 0);

      const availableUnits = Math.max(
        0,
        totalActiveUnits - maintenanceCount - reservedCount,
      );

      return {
        slotIndex: i,
        startTime: startTimeStr,
        endTime: endTimeStr,
        available: availableUnits > 0,
        availableUnits,
        totalUnits: totalActiveUnits,
        reason:
          availableUnits > 0
            ? undefined
            : maintenanceCount > 0
              ? 'MAINTENANCE'
              : 'BOOKED',
      };
    });

    return {
      facilityGroupId,
      groupName: group.name,
      reservationMode: ReservationMode.QUANTITY,
      usageDate,
      isOperationalDay: isOperDay,
      totalActiveUnits,
      slots,
    };
  }
}
