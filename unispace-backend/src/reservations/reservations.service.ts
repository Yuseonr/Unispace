import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  FacilityStatus,
  Prisma,
  ReservationMode,
  ReservationStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { GetAvailabilityDto } from './dto/get-availability.dto';
import { ListMyReservationsDto } from './dto/list-my-reservations.dto';
import { ListStaffReservationsDto } from './dto/list-staff-reservations.dto';
import { ApproveReservationDto } from './dto/approve-reservation.dto';
import {
  calculateDecisionDeadline,
  formatToJakartaDateString,
  isCancellationAllowed,
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
      finalFacilityGroupId = null;
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

  /**
   * Mengambil daftar riwayat permohonan reservasi milik pengguna yang sedang login (FR-RES-04).
   * Mendukung paginasi, filter status, filter tanggal pemakaian, serta komputasi canCancel dan alokasi aset.
   */
  async listMy(
    userId: string,
    query: ListMyReservationsDto,
    now: Date = new Date(),
  ) {
    const { status, usageDate, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    let usageDateFilter: Date | undefined;
    if (usageDate) {
      const [y, m, d] = usageDate.split('-').map(Number);
      usageDateFilter = new Date(Date.UTC(y, m - 1, d));
    }

    const where = {
      userId,
      ...(status ? { status } : {}),
      ...(usageDateFilter ? { usageDate: usageDateFilter } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ usageDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          facility: {
            select: {
              id: true,
              name: true,
              assetCode: true,
              facilityGroup: {
                select: {
                  id: true,
                  name: true,
                  locationDetail: true,
                  facilityArea: { select: { id: true, code: true, name: true } },
                  facilityType: { select: { id: true, name: true } },
                },
              },
            },
          },
          facilityGroup: {
            select: {
              id: true,
              name: true,
              reservationMode: true,
              locationDetail: true,
              facilityArea: { select: { id: true, code: true, name: true } },
              facilityType: { select: { id: true, name: true } },
            },
          },
          items: {
            include: {
              facility: {
                select: { id: true, assetCode: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    const data = items.map((res) => {
      const usageDateStr = formatToJakartaDateString(res.usageDate);
      const isEligibleStatus =
        res.status === ReservationStatus.PENDING ||
        res.status === ReservationStatus.APPROVED;
      const canCancel =
        isEligibleStatus && isCancellationAllowed(usageDateStr, now);

      const allocatedAssets =
        res.status === ReservationStatus.APPROVED
          ? res.items.length > 0
            ? res.items.map((item) => ({
                id: item.facility.id,
                assetCode: item.facility.assetCode,
                name: item.facility.name,
              }))
            : res.facility
              ? [
                  {
                    id: res.facility.id,
                    assetCode: res.facility.assetCode,
                    name: res.facility.name,
                  },
                ]
              : []
          : [];

      return {
        ...res,
        canCancel,
        allocatedAssets,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Mengambil rincian lengkap satu permohonan reservasi milik pengguna yang sedang login (FR-RES-04).
   * Memastikan pengguna hanya dapat mengakses reservasi miliknya sendiri.
   */
  async getMyDetail(userId: string, id: string, now: Date = new Date()) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, userId },
      include: {
        facility: {
          select: {
            id: true,
            name: true,
            assetCode: true,
            facilityGroup: {
              select: {
                id: true,
                name: true,
                locationDetail: true,
                facilityArea: { select: { id: true, code: true, name: true } },
                facilityType: { select: { id: true, name: true } },
              },
            },
          },
        },
        facilityGroup: {
          select: {
            id: true,
            name: true,
            reservationMode: true,
            locationDetail: true,
            facilityArea: { select: { id: true, code: true, name: true } },
            facilityType: { select: { id: true, name: true } },
          },
        },
        processedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            facility: {
              select: { id: true, assetCode: true, name: true },
            },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservasi tidak ditemukan.');
    }

    const usageDateStr = formatToJakartaDateString(reservation.usageDate);
    const isEligibleStatus =
      reservation.status === ReservationStatus.PENDING ||
      reservation.status === ReservationStatus.APPROVED;
    const canCancel =
      isEligibleStatus && isCancellationAllowed(usageDateStr, now);

    const allocatedAssets =
      reservation.status === ReservationStatus.APPROVED
        ? reservation.items.length > 0
          ? reservation.items.map((item) => ({
              id: item.facility.id,
              assetCode: item.facility.assetCode,
              name: item.facility.name,
            }))
          : reservation.facility
            ? [
                {
                  id: reservation.facility.id,
                  assetCode: reservation.facility.assetCode,
                  name: reservation.facility.name,
                },
              ]
            : []
        : [];

    return {
      ...reservation,
      canCancel,
      allocatedAssets,
    };
  }

  /**
   * Membatalkan permohonan reservasi mandiri oleh pemohon (FR-RES-06 & RULE-RES-03).
   * Hanya diizinkan untuk reservasi berstatus PENDING atau APPROVED,
   * dan maksimal diajukan sebelum pukul 20.00 WIB pada H-1 hari kerja sebelum pemakaian.
   */
  async cancelMy(userId: string, id: string, now: Date = new Date()) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, userId },
    });

    if (!reservation) {
      throw new NotFoundException('Reservasi tidak ditemukan.');
    }

    if (
      reservation.status !== ReservationStatus.PENDING &&
      reservation.status !== ReservationStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Reservasi dengan status ${reservation.status} tidak dapat dibatalkan.`,
      );
    }

    const usageDateStr = formatToJakartaDateString(reservation.usageDate);
    if (!isCancellationAllowed(usageDateStr, now)) {
      throw new BadRequestException(
        'Batas waktu pembatalan mandiri telah terlewati (maksimal pukul 20.00 WIB pada H-1 hari kerja operasional).',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELLED_BY_USER,
          cancelledAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'RESERVATION_CANCELLED_BY_USER',
          entityType: 'RESERVATION',
          entityId: id,
          metadata: {
            previousStatus: reservation.status,
            cancelledAt: now.toISOString(),
          },
        },
      });

      return updated;
    });
  }

  /**
   * Mengambil daftar antrean permohonan reservasi untuk petugas dan admin (FR-RES-05).
   * Mendukung paginasi, filter status, tanggal, area fasilitas, dan pencarian nama.
   * Mengurutkan berdasarkan urgensi batas waktu SLA (decisionDeadline asc) saat status PENDING.
   */
  async listStaff(query: ListStaffReservationsDto) {
    const {
      status,
      usageDate,
      facilityId,
      facilityGroupId,
      facilityAreaId,
      search,
      page = 1,
      limit = 10,
    } = query;
    const skip = (page - 1) * limit;

    let usageDateFilter: Date | undefined;
    if (usageDate) {
      const [y, m, d] = usageDate.split('-').map(Number);
      usageDateFilter = new Date(Date.UTC(y, m - 1, d));
    }

    const where: Prisma.ReservationWhereInput = {
      ...(status ? { status } : {}),
      ...(usageDateFilter ? { usageDate: usageDateFilter } : {}),
      ...(facilityId ? { facilityId } : {}),
      ...(facilityGroupId ? { facilityGroupId } : {}),
    };

    const conditions: Prisma.ReservationWhereInput[] = [];

    if (facilityAreaId) {
      conditions.push({
        OR: [
          { facility: { facilityGroup: { facilityAreaId } } },
          { facilityGroup: { facilityAreaId } },
        ],
      });
    }

    if (search) {
      conditions.push({
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { identityNumber: { contains: search, mode: 'insensitive' } } },
          { facility: { name: { contains: search, mode: 'insensitive' } } },
          { facility: { assetCode: { contains: search, mode: 'insensitive' } } },
          { facilityGroup: { name: { contains: search, mode: 'insensitive' } } },
          { purpose: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    // Urutan prioritas: Jika PENDING, utamakan decisionDeadline terdekat (SLA paling kritis)
    const orderBy: Prisma.ReservationOrderByWithRelationInput[] =
      status === ReservationStatus.PENDING
        ? [{ decisionDeadline: 'asc' }, { createdAt: 'asc' }]
        : [{ usageDate: 'desc' }, { createdAt: 'desc' }];

    const [total, items] = await Promise.all([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              identityNumber: true,
            },
          },
          facility: {
            select: {
              id: true,
              name: true,
              assetCode: true,
              facilityGroup: {
                select: {
                  id: true,
                  name: true,
                  locationDetail: true,
                  facilityArea: { select: { id: true, code: true, name: true } },
                  facilityType: { select: { id: true, name: true } },
                },
              },
            },
          },
          facilityGroup: {
            select: {
              id: true,
              name: true,
              reservationMode: true,
              locationDetail: true,
              facilityArea: { select: { id: true, code: true, name: true } },
              facilityType: { select: { id: true, name: true } },
            },
          },
          processedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              facility: {
                select: { id: true, assetCode: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    const data = items.map((res) => {
      const allocatedAssets =
        res.status === ReservationStatus.APPROVED
          ? res.items.length > 0
            ? res.items.map((item) => ({
                id: item.facility.id,
                assetCode: item.facility.assetCode,
                name: item.facility.name,
              }))
            : res.facility
              ? [
                  {
                    id: res.facility.id,
                    assetCode: res.facility.assetCode,
                    name: res.facility.name,
                  },
                ]
              : []
          : [];

      return {
        ...res,
        allocatedAssets,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Mengambil rincian lengkap satu permohonan reservasi untuk petugas dan admin (FR-RES-05).
   */
  async getStaffDetail(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            identityNumber: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
            assetCode: true,
            facilityGroup: {
              select: {
                id: true,
                name: true,
                locationDetail: true,
                facilityArea: { select: { id: true, code: true, name: true } },
                facilityType: { select: { id: true, name: true } },
              },
            },
          },
        },
        facilityGroup: {
          select: {
            id: true,
            name: true,
            reservationMode: true,
            locationDetail: true,
            facilityArea: { select: { id: true, code: true, name: true } },
            facilityType: { select: { id: true, name: true } },
          },
        },
        processedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            facility: {
              select: { id: true, assetCode: true, name: true },
            },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservasi tidak ditemukan.');
    }

    const allocatedAssets =
      reservation.status === ReservationStatus.APPROVED
        ? reservation.items.length > 0
          ? reservation.items.map((item) => ({
              id: item.facility.id,
              assetCode: item.facility.assetCode,
              name: item.facility.name,
            }))
          : reservation.facility
            ? [
                {
                  id: reservation.facility.id,
                  assetCode: reservation.facility.assetCode,
                  name: reservation.facility.name,
                },
              ]
            : []
        : [];

    return {
      ...reservation,
      allocatedAssets,
    };
  }

  /**
   * Menyetujui permohonan reservasi secara atomik oleh petugas atau admin (FR-RES-05 & RULE-RES-04).
   * - Mode Ruang (EXCLUSIVE): Mengunci slot waktu & cascade auto-reject pengajuan PENDING yang bentrok.
   * - Mode Alat (QUANTITY): Mengalokasikan unit aset fisik ke ReservationItem & cascade auto-reject pengajuan PENDING yang kekurangan stok.
   */
  async approve(
    staffId: string,
    id: string,
    dto: ApproveReservationDto,
    now: Date = new Date(),
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        facility: {
          select: {
            id: true,
            name: true,
            assetCode: true,
            status: true,
            facilityGroupId: true,
          },
        },
        facilityGroup: {
          select: {
            id: true,
            name: true,
            reservationMode: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservasi tidak ditemukan.');
    }

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'Hanya reservasi berstatus PENDING yang dapat disetujui.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const uYear = reservation.usageDate.getUTCFullYear();
      const uMonth = reservation.usageDate.getUTCMonth();
      const uDay = reservation.usageDate.getUTCDate();
      const sH = reservation.startTime.getUTCHours();
      const sM = reservation.startTime.getUTCMinutes();
      const eH = reservation.endTime.getUTCHours();
      const eM = reservation.endTime.getUTCMinutes();

      const startUtc = new Date(Date.UTC(uYear, uMonth, uDay, sH - 7, sM, 0));
      const endUtc = new Date(Date.UTC(uYear, uMonth, uDay, eH - 7, eM, 0));

      if (reservation.facilityId) {
        // =====================================================================
        // A. Mode Ruang Tunggal (EXCLUSIVE)
        // =====================================================================
        if (dto.allocatedAssetIds && dto.allocatedAssetIds.length > 0) {
          throw new BadRequestException(
            'Alokasi unit aset fisik (allocatedAssetIds) hanya digunakan untuk kelompok alat (QUANTITY).',
          );
        }

        if (reservation.facility?.status !== FacilityStatus.ACTIVE) {
          throw new BadRequestException('Fasilitas sedang tidak aktif.');
        }

        const maintenance = await tx.maintenancePeriod.findFirst({
          where: {
            facilityId: reservation.facilityId,
            startAt: { lt: endUtc },
            endAt: { gt: startUtc },
          },
        });
        if (maintenance) {
          throw new BadRequestException(
            'Fasilitas sedang dalam periode pemeliharaan pada jadwal yang dipilih.',
          );
        }

        const conflictingApproved = await tx.reservation.findFirst({
          where: {
            id: { not: reservation.id },
            facilityId: reservation.facilityId,
            usageDate: reservation.usageDate,
            status: ReservationStatus.APPROVED,
            startTime: { lt: reservation.endTime },
            endTime: { gt: reservation.startTime },
          },
        });
        if (conflictingApproved) {
          throw new BadRequestException(
            'Slot fasilitas pada jadwal tersebut sudah disetujui untuk reservasi lain.',
          );
        }

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.APPROVED,
            processedById: staffId,
            decidedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: staffId,
            action: 'RESERVATION_APPROVED',
            entityType: 'RESERVATION',
            entityId: reservation.id,
            metadata: {
              facilityId: reservation.facilityId,
              usageDate: reservation.usageDate,
              startTime: reservation.startTime,
              endTime: reservation.endTime,
            },
          },
        });

        // Cascade auto-reject pengajuan PENDING lain yang bentrok
        const conflictingPending = await tx.reservation.findMany({
          where: {
            id: { not: reservation.id },
            facilityId: reservation.facilityId,
            usageDate: reservation.usageDate,
            status: ReservationStatus.PENDING,
            startTime: { lt: reservation.endTime },
            endTime: { gt: reservation.startTime },
          },
          select: { id: true },
        });

        if (conflictingPending.length > 0) {
          const pendingIds = conflictingPending.map((p) => p.id);
          await tx.reservation.updateMany({
            where: { id: { in: pendingIds } },
            data: {
              status: ReservationStatus.REJECTED,
              processedById: staffId,
              decidedAt: now,
              decisionReason:
                'Slot fasilitas telah disetujui untuk permohonan reservasi lain.',
            },
          });

          for (const pendingId of pendingIds) {
            await tx.auditLog.create({
              data: {
                actorId: staffId,
                action: 'RESERVATION_AUTO_REJECTED',
                entityType: 'RESERVATION',
                entityId: pendingId,
                metadata: {
                  reason:
                    'Slot fasilitas telah disetujui untuk permohonan reservasi lain.',
                  conflictingApprovedReservationId: reservation.id,
                },
              },
            });
          }
        }
      } else if (reservation.facilityGroupId) {
        // =====================================================================
        // B. Mode Kelompok Alat (QUANTITY)
        // =====================================================================
        const allocatedAssetIds = dto.allocatedAssetIds ?? [];
        if (allocatedAssetIds.length === 0) {
          throw new BadRequestException(
            'Alokasi unit aset fisik (allocatedAssetIds) wajib ditentukan untuk permohonan kelompok alat.',
          );
        }

        if (allocatedAssetIds.length !== reservation.requestedQuantity) {
          throw new BadRequestException(
            `Jumlah aset yang dialokasikan (${allocatedAssetIds.length}) harus sama dengan kuantitas yang diajukan (${reservation.requestedQuantity}).`,
          );
        }

        const uniqueAssetIds = new Set(allocatedAssetIds);
        if (uniqueAssetIds.size !== allocatedAssetIds.length) {
          throw new BadRequestException(
            'Terdapat duplikasi ID aset dalam daftar alokasi.',
          );
        }

        const validFacilities = await tx.facility.findMany({
          where: {
            id: { in: allocatedAssetIds },
            facilityGroupId: reservation.facilityGroupId,
            status: FacilityStatus.ACTIVE,
          },
          select: { id: true, assetCode: true },
        });

        if (validFacilities.length !== allocatedAssetIds.length) {
          throw new BadRequestException(
            'Satu atau lebih aset yang dipilih tidak valid, tidak aktif, atau bukan bagian dari kelompok fasilitas ini.',
          );
        }

        const maintenance = await tx.maintenancePeriod.findFirst({
          where: {
            facilityId: { in: allocatedAssetIds },
            startAt: { lt: endUtc },
            endAt: { gt: startUtc },
          },
          include: { facility: { select: { assetCode: true } } },
        });
        if (maintenance) {
          throw new BadRequestException(
            `Aset ${maintenance.facility.assetCode} sedang dalam masa pemeliharaan pada jadwal tersebut.`,
          );
        }

        const conflictingItem = await tx.reservationItem.findFirst({
          where: {
            facilityId: { in: allocatedAssetIds },
            reservation: {
              id: { not: reservation.id },
              status: ReservationStatus.APPROVED,
              usageDate: reservation.usageDate,
              startTime: { lt: reservation.endTime },
              endTime: { gt: reservation.startTime },
            },
          },
          include: { facility: { select: { assetCode: true } } },
        });
        if (conflictingItem) {
          throw new BadRequestException(
            `Aset ${conflictingItem.facility.assetCode} sudah dialokasikan untuk permohonan reservasi lain pada jadwal yang dipilih.`,
          );
        }

        await tx.reservationItem.createMany({
          data: allocatedAssetIds.map((assetId) => ({
            reservationId: reservation.id,
            facilityId: assetId,
          })),
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.APPROVED,
            processedById: staffId,
            decidedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: staffId,
            action: 'RESERVATION_APPROVED',
            entityType: 'RESERVATION',
            entityId: reservation.id,
            metadata: {
              facilityGroupId: reservation.facilityGroupId,
              requestedQuantity: reservation.requestedQuantity,
              allocatedAssetIds,
              usageDate: reservation.usageDate,
              startTime: reservation.startTime,
              endTime: reservation.endTime,
            },
          },
        });

        // Cascade auto-reject pengajuan PENDING kelompok alat yang kekurangan stok
        const candidatePending = await tx.reservation.findMany({
          where: {
            id: { not: reservation.id },
            facilityGroupId: reservation.facilityGroupId,
            usageDate: reservation.usageDate,
            status: ReservationStatus.PENDING,
            startTime: { lt: reservation.endTime },
            endTime: { gt: reservation.startTime },
          },
        });

        if (candidatePending.length > 0) {
          const groupFacilities = await tx.facility.findMany({
            where: {
              facilityGroupId: reservation.facilityGroupId,
              status: FacilityStatus.ACTIVE,
            },
            select: { id: true },
          });
          const totalActiveUnits = groupFacilities.length;
          const activeUnitIds = groupFacilities.map((f) => f.id);

          const approvedReservations = await tx.reservation.findMany({
            where: {
              facilityGroupId: reservation.facilityGroupId,
              usageDate: reservation.usageDate,
              status: ReservationStatus.APPROVED,
            },
            select: {
              startTime: true,
              endTime: true,
              requestedQuantity: true,
            },
          });

          const dayStartUtc = new Date(Date.UTC(uYear, uMonth, uDay, 0, 0, 0));
          const dayEndUtc = new Date(Date.UTC(uYear, uMonth, uDay, 13, 0, 0));

          const maintenancePeriods =
            activeUnitIds.length > 0
              ? await tx.maintenancePeriod.findMany({
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
              : [];

          for (const pending of candidatePending) {
            const pStartMin =
              pending.startTime.getUTCHours() * 60 +
              pending.startTime.getUTCMinutes();
            const pEndMin =
              pending.endTime.getUTCHours() * 60 +
              pending.endTime.getUTCMinutes();

            let hasInsufficientStock = false;

            for (let m = pStartMin; m < pEndMin; m += 30) {
              const slotStartH = Math.floor(m / 60);
              const slotStartM = m % 60;
              const slotEndH = Math.floor((m + 30) / 60);
              const slotEndM = (m + 30) % 60;

              const slotStartTime = new Date(
                Date.UTC(1970, 0, 1, slotStartH, slotStartM, 0),
              );
              const slotEndTime = new Date(
                Date.UTC(1970, 0, 1, slotEndH, slotEndM, 0),
              );

              const slotStartUtc = new Date(
                Date.UTC(uYear, uMonth, uDay, slotStartH - 7, slotStartM, 0),
              );
              const slotEndUtc = new Date(
                Date.UTC(uYear, uMonth, uDay, slotEndH - 7, slotEndM, 0),
              );

              const maintenanceCount = new Set(
                maintenancePeriods
                  .filter(
                    (mp) => mp.startAt < slotEndUtc && mp.endAt > slotStartUtc,
                  )
                  .map((mp) => mp.facilityId),
              ).size;

              const reservedCount = approvedReservations
                .filter(
                  (ar) =>
                    ar.startTime < slotEndTime && ar.endTime > slotStartTime,
                )
                .reduce((sum, ar) => sum + ar.requestedQuantity, 0);

              const availableUnits =
                totalActiveUnits - maintenanceCount - reservedCount;
              if (availableUnits < pending.requestedQuantity) {
                hasInsufficientStock = true;
                break;
              }
            }

            if (hasInsufficientStock) {
              await tx.reservation.update({
                where: { id: pending.id },
                data: {
                  status: ReservationStatus.REJECTED,
                  processedById: staffId,
                  decidedAt: now,
                  decisionReason:
                    'Ketersediaan unit fasilitas tidak lagi mencukupi untuk memenuhi jumlah yang diajukan.',
                },
              });

              await tx.auditLog.create({
                data: {
                  actorId: staffId,
                  action: 'RESERVATION_AUTO_REJECTED',
                  entityType: 'RESERVATION',
                  entityId: pending.id,
                  metadata: {
                    reason:
                      'Ketersediaan unit fasilitas tidak lagi mencukupi untuk memenuhi jumlah yang diajukan.',
                    approvedReservationId: reservation.id,
                  },
                },
              });
            }
          }
        }
      }
    });

    return this.getStaffDetail(id);
  }
}

