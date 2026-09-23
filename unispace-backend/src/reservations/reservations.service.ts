import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  FacilityStatus,
  ReservationMode,
  ReservationStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { GetAvailabilityDto } from './dto/get-availability.dto';
import {
  calculateDecisionDeadline,
  isOperationalDay,
  isValidSlotBoundary,
  isWithinLeadTime,
  isWithinMaxAdvance,
  isWithinOperationHours,
} from './utils/reservation-time.util';

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

  /**
   * Mengajukan permohonan reservasi baru oleh pengguna terautentikasi (FR-RES-01).
   * Melakukan validasi izin akun, aturan waktu Jakarta, ketersediaan slot,
   * penghitungan SLA batas keputusan (decisionDeadline), dan pencatatan audit log.
   */
  async create(
    userId: string,
    dto: CreateReservationDto,
    now: Date = new Date(),
  ) {
    const {
      facilityId,
      facilityGroupId,
      requestedQuantity = 1,
      usageDate,
      startTime,
      endTime,
      purpose,
    } = dto;

    // 1. Validasi Pemilihan Target (Pilih salah satu)
    if ((!facilityId && !facilityGroupId) || (facilityId && facilityGroupId)) {
      throw new BadRequestException(
        'Pilih salah satu: facilityId (ruang eksklusif) atau facilityGroupId (kelompok alat).',
      );
    }

    // 2. Validasi Akun Pemohon
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException(
        'Akun Anda belum aktif atau tidak memiliki izin untuk mengajukan reservasi.',
      );
    }

    // 3. Validasi Aturan Waktu Operasional
    if (!isValidSlotBoundary(startTime) || !isValidSlotBoundary(endTime)) {
      throw new BadRequestException(
        'Waktu mulai dan selesai harus berupa kelipatan 30 menit (contoh 07:00, 07:30).',
      );
    }

    if (!isWithinOperationHours(startTime, endTime)) {
      throw new BadRequestException(
        'Waktu reservasi harus berada di dalam jam operasional 07.00 - 20.00 WIB.',
      );
    }

    if (!isOperationalDay(usageDate)) {
      throw new BadRequestException(
        'Reservasi hanya dapat diajukan pada hari operasional (Senin s/d Jumat).',
      );
    }

    if (!isWithinLeadTime(usageDate, now)) {
      throw new BadRequestException(
        'Reservasi harus diajukan minimal H-2 hari kerja sebelum tanggal pemakaian.',
      );
    }

    if (!isWithinMaxAdvance(usageDate, now)) {
      throw new BadRequestException(
        'Reservasi hanya dapat diajukan maksimal 14 hari ke depan.',
      );
    }

    const [year, month, day] = usageDate.split('-').map(Number);
    const usageDateObj = new Date(Date.UTC(year, month - 1, day));

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startTimeDate = new Date(
      Date.UTC(1970, 0, 1, startHour, startMin, 0),
    );
    const endTimeDate = new Date(Date.UTC(1970, 0, 1, endHour, endMin, 0));

    const startUtc = new Date(
      Date.UTC(year, month - 1, day, startHour - 7, startMin, 0),
    );
    const endUtc = new Date(
      Date.UTC(year, month - 1, day, endHour - 7, endMin, 0),
    );

    let finalFacilityId: string | null = null;
    let finalFacilityGroupId: string | null = null;
    let finalQuantity = 1;

    // 4. Mode Ruang Eksklusif
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
      if (facility.status !== FacilityStatus.ACTIVE) {
        throw new BadRequestException('Fasilitas sedang tidak aktif.');
      }
      if (
        facility.facilityGroup.reservationMode !== ReservationMode.EXCLUSIVE
      ) {
        throw new BadRequestException(
          'Fasilitas ini bukan untuk mode peminjaman eksklusif.',
        );
      }

      // Cek apakah fasilitas sedang dalam masa perbaikan
      const maintenance = await this.prisma.maintenancePeriod.findFirst({
        where: {
          facilityId,
          startAt: { lt: endUtc },
          endAt: { gt: startUtc },
        },
      });
      if (maintenance) {
        throw new BadRequestException(
          'Fasilitas sedang dalam masa perbaikan pada rentang waktu yang dipilih.',
        );
      }

      // Cek bentrok dengan reservasi yang sudah disetujui (APPROVED)
      const conflict = await this.prisma.reservation.findFirst({
        where: {
          facilityId,
          usageDate: usageDateObj,
          status: ReservationStatus.APPROVED,
          startTime: { lt: endTimeDate },
          endTime: { gt: startTimeDate },
        },
      });
      if (conflict) {
        throw new BadRequestException(
          'Fasilitas sudah dipesan oleh pihak lain pada rentang waktu yang dipilih.',
        );
      }

      finalFacilityId = facility.id;
      finalFacilityGroupId = facility.facilityGroupId;
      finalQuantity = 1;
    }

    // 5. Mode Kelompok Alat (QUANTITY)
    if (facilityGroupId) {
      finalQuantity = requestedQuantity ?? 1;
      if (finalQuantity < 1) {
        throw new BadRequestException('Jumlah unit yang dipinjam minimal 1.');
      }

      const group = await this.prisma.facilityGroup.findFirst({
        where: {
          id: facilityGroupId,
          reservationMode: ReservationMode.QUANTITY,
        },
        include: {
          facilities: {
            where: { status: FacilityStatus.ACTIVE },
            select: { id: true },
          },
        },
      });

      if (!group) {
        throw new NotFoundException('Kelompok alat tidak ditemukan.');
      }

      const totalActiveUnits = group.facilities.length;
      if (totalActiveUnits === 0) {
        throw new BadRequestException(
          'Tidak ada unit alat yang aktif saat ini.',
        );
      }
      if (finalQuantity > totalActiveUnits) {
        throw new BadRequestException(
          `Jumlah unit yang diminta (${finalQuantity}) melebihi total unit aktif (${totalActiveUnits}).`,
        );
      }

      const activeUnitIds = group.facilities.map((f) => f.id);

      const [approvedReservations, maintenancePeriods] = await Promise.all([
        this.prisma.reservation.findMany({
          where: {
            facilityGroupId,
            usageDate: usageDateObj,
            status: ReservationStatus.APPROVED,
            startTime: { lt: endTimeDate },
            endTime: { gt: startTimeDate },
          },
          select: {
            startTime: true,
            endTime: true,
            requestedQuantity: true,
          },
        }),
        this.prisma.maintenancePeriod.findMany({
          where: {
            facilityId: { in: activeUnitIds },
            startAt: { lt: endUtc },
            endAt: { gt: startUtc },
          },
          select: {
            facilityId: true,
            startAt: true,
            endAt: true,
          },
        }),
      ]);

      const startTotalMin = startHour * 60 + startMin;
      const endTotalMin = endHour * 60 + endMin;

      for (
        let currentMin = startTotalMin;
        currentMin < endTotalMin;
        currentMin += 30
      ) {
        const slotStartHour = Math.floor(currentMin / 60);
        const slotStartM = currentMin % 60;
        const slotEndHour = Math.floor((currentMin + 30) / 60);
        const slotEndM = (currentMin + 30) % 60;

        const slotStartTime = new Date(
          Date.UTC(1970, 0, 1, slotStartHour, slotStartM, 0),
        );
        const slotEndTime = new Date(
          Date.UTC(1970, 0, 1, slotEndHour, slotEndM, 0),
        );

        const slotStartUtc = new Date(
          Date.UTC(year, month - 1, day, slotStartHour - 7, slotStartM, 0),
        );
        const slotEndUtc = new Date(
          Date.UTC(year, month - 1, day, slotEndHour - 7, slotEndM, 0),
        );

        const maintenanceCount = new Set(
          maintenancePeriods
            .filter((m) => m.startAt < slotEndUtc && m.endAt > slotStartUtc)
            .map((m) => m.facilityId),
        ).size;

        const reservedCount = approvedReservations
          .filter((r) => r.startTime < slotEndTime && r.endTime > slotStartTime)
          .reduce((sum, r) => sum + r.requestedQuantity, 0);

        const availableUnits =
          totalActiveUnits - maintenanceCount - reservedCount;
        if (availableUnits < finalQuantity) {
          throw new BadRequestException(
            `Ketersediaan alat tidak mencukupi pada slot ${String(slotStartHour).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}.`,
          );
        }
      }

      finalFacilityId = null;
      finalFacilityGroupId = group.id;
    }

    // 6. Hitung Batas SLA Tenggat Keputusan (decisionDeadline)
    const decisionDeadline = calculateDecisionDeadline(now, usageDate);

    // 7. Simpan ke Database secara Atomik & Catat Audit Log
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          userId,
          facilityId: finalFacilityId,
          facilityGroupId: finalFacilityGroupId,
          requestedQuantity: finalQuantity,
          usageDate: usageDateObj,
          startTime: startTimeDate,
          endTime: endTimeDate,
          purpose,
          status: ReservationStatus.PENDING,
          decisionDeadline,
        },
        include: {
          facility: {
            select: { id: true, name: true, assetCode: true },
          },
          facilityGroup: {
            select: { id: true, name: true, reservationMode: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'RESERVATION_CREATED',
          entityType: 'RESERVATION',
          entityId: reservation.id,
          metadata: {
            facilityId: reservation.facilityId,
            facilityGroupId: reservation.facilityGroupId,
            requestedQuantity: reservation.requestedQuantity,
            usageDate,
            startTime,
            endTime,
            decisionDeadline: decisionDeadline.toISOString(),
          },
        },
      });

      return reservation;
    });
  }
}
