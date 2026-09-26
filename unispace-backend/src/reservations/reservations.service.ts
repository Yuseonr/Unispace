import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AccountStatus,
  FacilityStatus,
  Prisma,
  ReservationMode,
  ReservationStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListMyReservationsDto } from './dto/list-my-reservations.dto';
import { ListStaffReservationsDto } from './dto/list-staff-reservations.dto';
import { ApproveReservationDto } from './dto/approve-reservation.dto';
import { RejectReservationDto } from './dto/reject-reservation.dto';
import { CancelStaffReservationDto } from './dto/cancel-staff-reservation.dto';
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

  private generateReservationNumber(now: Date) {
    const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);
    return `RSV-${timestamp}-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  }

  private reservationEndAtInJakarta(usageDate: Date, endTime: Date) {
    const date = formatToJakartaDateString(usageDate);
    const hours = String(endTime.getUTCHours()).padStart(2, '0');
    const minutes = String(endTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(endTime.getUTCSeconds()).padStart(2, '0');
    return new Date(`${date}T${hours}:${minutes}:${seconds}.000+07:00`);
  }

  private reservationDateStartInJakarta(now: Date) {
    const [year, month, day] = formatToJakartaDateString(now)
      .split('-')
      .map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private mapAllocatedAssets(reservation: {
    status: ReservationStatus;
    facility: {
      id: string;
      assetCode: string;
      name: string | null;
    } | null;
    items: Array<{
      facility: {
        id: string;
        assetCode: string;
        name: string | null;
      };
    }>;
  }) {
    if (
      reservation.status !== ReservationStatus.APPROVED &&
      reservation.status !== ReservationStatus.COMPLETED
    ) {
      return [];
    }

    if (reservation.items.length > 0) {
      return reservation.items.map((item) => ({
        id: item.facility.id,
        assetCode: item.facility.assetCode,
        name: item.facility.name,
      }));
    }

    return reservation.facility
      ? [
          {
            id: reservation.facility.id,
            assetCode: reservation.facility.assetCode,
            name: reservation.facility.name,
          },
        ]
      : [];
  }

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!isSerializationConflict) {
          throw error;
        }

        if (attempt === maxAttempts) {
          throw new BadRequestException(
            'Persetujuan reservasi berubah karena ada proses lain. Silakan muat ulang data dan coba kembali.',
          );
        }
      }
    }

    throw new BadRequestException(
      'Persetujuan reservasi tidak dapat diproses.',
    );
  }

  private async markReservationApproved(
    transaction: Pick<Prisma.TransactionClient, 'reservation'>,
    reservationId: string,
    staffId: string,
    decidedAt: Date,
  ) {
    const result = await transaction.reservation.updateMany({
      where: { id: reservationId, status: ReservationStatus.PENDING },
      data: {
        status: ReservationStatus.APPROVED,
        processedById: staffId,
        decidedAt,
      },
    });

    if (result.count !== 1) {
      throw new BadRequestException(
        'Reservasi sudah diproses oleh petugas lain.',
      );
    }
  }

  private async lockQuantityApprovalContext(
    transaction: Pick<Prisma.TransactionClient, '$executeRaw'>,
    facilityGroupId: string,
    usageDate: Date,
  ) {
    const usageDateKey = [
      usageDate.getUTCFullYear(),
      String(usageDate.getUTCMonth() + 1).padStart(2, '0'),
      String(usageDate.getUTCDate()).padStart(2, '0'),
    ].join('-');

    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${facilityGroupId}),
        hashtext(${usageDateKey})
      )
    `;
  }

  private selectAvailableQuantityUnits(
    transaction: Pick<Prisma.TransactionClient, 'facility'>,
    params: {
      facilityGroupId: string;
      usageDate: Date;
      startTime: Date;
      endTime: Date;
      startUtc: Date;
      endUtc: Date;
      requestedQuantity: number;
    },
  ) {
    return transaction.facility.findMany({
      where: {
        facilityGroupId: params.facilityGroupId,
        status: { not: FacilityStatus.NONACTIVE },
        maintenancePeriods: {
          none: {
            startAt: { lt: params.endUtc },
            endAt: { gt: params.startUtc },
          },
        },
        reservationItems: {
          none: {
            reservation: {
              status: ReservationStatus.APPROVED,
              usageDate: params.usageDate,
              startTime: { lt: params.endTime },
              endTime: { gt: params.startTime },
            },
          },
        },
      },
      select: { id: true, assetCode: true },
      orderBy: [{ assetCode: 'asc' }, { id: 'asc' }],
      take: params.requestedQuantity,
    });
  }

  private async rejectPendingReservation(
    transaction: Pick<Prisma.TransactionClient, 'reservation' | 'auditLog'>,
    params: {
      reservationId: string;
      staffId: string;
      decidedAt: Date;
      reason: string;
      action: 'RESERVATION_REJECTED' | 'RESERVATION_AUTO_REJECTED';
      metadata: Prisma.InputJsonObject;
    },
  ) {
    const result = await transaction.reservation.updateMany({
      where: {
        id: params.reservationId,
        status: ReservationStatus.PENDING,
      },
      data: {
        status: ReservationStatus.REJECTED,
        processedById: params.staffId,
        decidedAt: params.decidedAt,
        decisionReason: params.reason,
      },
    });

    if (result.count === 1) {
      await transaction.auditLog.create({
        data: {
          actorId: params.staffId,
          action: params.action,
          entityType: 'RESERVATION',
          entityId: params.reservationId,
          metadata: params.metadata,
        },
      });
    }

    return result.count === 1;
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
    const normalizedPurpose =
      typeof purpose === 'string' && purpose.trim() ? purpose.trim() : 'NULL';

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
      if (facility.status === FacilityStatus.NONACTIVE) {
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
            where: { status: { not: FacilityStatus.NONACTIVE } },
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
          reservationNumber: this.generateReservationNumber(now),
          userId,
          facilityId: finalFacilityId,
          facilityGroupId: finalFacilityGroupId,
          requestedQuantity: finalQuantity,
          usageDate: usageDateObj,
          startTime: startTimeDate,
          endTime: endTimeDate,
          purpose: normalizedPurpose,
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
                  facilityArea: {
                    select: { id: true, code: true, name: true },
                  },
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

      return {
        ...res,
        canCancel,
        allocatedAssets: this.mapAllocatedAssets(res),
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

    return {
      ...reservation,
      canCancel,
      allocatedAssets: this.mapAllocatedAssets(reservation),
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
      const changed = await tx.reservation.updateMany({
        where: {
          id,
          userId,
          status: {
            in: [ReservationStatus.PENDING, ReservationStatus.APPROVED],
          },
        },
        data: {
          status: ReservationStatus.CANCELLED_BY_USER,
          cancelledAt: now,
        },
      });

      if (changed.count !== 1) {
        throw new ConflictException(
          'Reservasi sudah diproses oleh petugas atau sistem.',
        );
      }

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

      return tx.reservation.findUnique({ where: { id } });
    });
  }

  /**
   * Mengambil daftar antrean permohonan reservasi untuk petugas (STAFF) (FR-RES-03).
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
          {
            user: { identityNumber: { contains: search, mode: 'insensitive' } },
          },
          { facility: { name: { contains: search, mode: 'insensitive' } } },
          {
            facility: { assetCode: { contains: search, mode: 'insensitive' } },
          },
          {
            facilityGroup: { name: { contains: search, mode: 'insensitive' } },
          },
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
                  facilityArea: {
                    select: { id: true, code: true, name: true },
                  },
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
      return {
        ...res,
        allocatedAssets: this.mapAllocatedAssets(res),
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
   * Mengambil rincian lengkap satu permohonan reservasi untuk petugas (STAFF) (FR-RES-03).
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

    return {
      ...reservation,
      allocatedAssets: this.mapAllocatedAssets(reservation),
    };
  }

  /**
   * Menyetujui permohonan reservasi secara atomik oleh petugas (STAFF) (FR-RES-04 & RULE-RES-05).
   * - Mode Ruang (EXCLUSIVE): Mengunci slot waktu & cascade auto-reject pengajuan PENDING yang bentrok.
   * - Mode Alat (QUANTITY): Mengalokasikan unit aset fisik ke ReservationItem & cascade auto-reject pengajuan PENDING yang kekurangan stok.
   */
  async approve(
    staffId: string,
    id: string,
    dto: ApproveReservationDto,
    now: Date = new Date(),
  ) {
    // Kompatibilitas sementara: field lama tetap diterima, tetapi keputusan
    // pemilihan unit fisik selalu dibuat oleh backend.
    void dto;

    await this.runSerializableTransaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
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

      if (reservation.decisionDeadline && reservation.decisionDeadline <= now) {
        throw new BadRequestException(
          'Permohonan reservasi tidak dapat disetujui karena telah melewati batas tenggat evaluasi petugas (SLA Expired).',
        );
      }

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
        if (reservation.facility?.status === FacilityStatus.NONACTIVE) {
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

        await this.markReservationApproved(tx, reservation.id, staffId, now);

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
          for (const pending of conflictingPending) {
            await this.rejectPendingReservation(tx, {
              reservationId: pending.id,
              staffId,
              decidedAt: now,
              reason:
                'Slot fasilitas telah disetujui untuk permohonan reservasi lain.',
              action: 'RESERVATION_AUTO_REJECTED',
              metadata: {
                reason:
                  'Slot fasilitas telah disetujui untuk permohonan reservasi lain.',
                conflictingApprovedReservationId: reservation.id,
              },
            });
          }
        }
      } else if (reservation.facilityGroupId) {
        // =====================================================================
        // B. Mode Kelompok Alat (QUANTITY)
        // =====================================================================
        await this.lockQuantityApprovalContext(
          tx,
          reservation.facilityGroupId,
          reservation.usageDate,
        );

        const allocatedFacilities = await this.selectAvailableQuantityUnits(
          tx,
          {
            facilityGroupId: reservation.facilityGroupId,
            usageDate: reservation.usageDate,
            startTime: reservation.startTime,
            endTime: reservation.endTime,
            startUtc,
            endUtc,
            requestedQuantity: reservation.requestedQuantity,
          },
        );

        if (allocatedFacilities.length !== reservation.requestedQuantity) {
          const rejectionReason =
            'Ketersediaan unit fasilitas berubah dan tidak lagi mencukupi untuk memenuhi jumlah yang diajukan.';
          const wasRejected = await this.rejectPendingReservation(tx, {
            reservationId: reservation.id,
            staffId,
            decidedAt: now,
            reason: rejectionReason,
            action: 'RESERVATION_REJECTED',
            metadata: {
              reason: rejectionReason,
              requestedQuantity: reservation.requestedQuantity,
              availableQuantity: allocatedFacilities.length,
              rejectionSource: 'APPROVAL_STOCK_RECONCILIATION',
            },
          });

          if (!wasRejected) {
            throw new BadRequestException(
              'Reservasi sudah diproses oleh petugas lain.',
            );
          }

          return;
        }

        const allocatedAssetIds = allocatedFacilities.map(
          (facility) => facility.id,
        );

        await this.markReservationApproved(tx, reservation.id, staffId, now);

        await tx.reservationItem.createMany({
          data: allocatedAssetIds.map((assetId) => ({
            reservationId: reservation.id,
            facilityId: assetId,
          })),
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
              status: { not: FacilityStatus.NONACTIVE },
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
              await this.rejectPendingReservation(tx, {
                reservationId: pending.id,
                staffId,
                decidedAt: now,
                reason:
                  'Ketersediaan unit fasilitas tidak lagi mencukupi untuk memenuhi jumlah yang diajukan.',
                action: 'RESERVATION_AUTO_REJECTED',
                metadata: {
                  reason:
                    'Ketersediaan unit fasilitas tidak lagi mencukupi untuk memenuhi jumlah yang diajukan.',
                  approvedReservationId: reservation.id,
                },
              });
            }
          }
        }
      } else {
        throw new BadRequestException(
          'Reservasi tidak memiliki target fasilitas yang valid.',
        );
      }
    });

    return this.getStaffDetail(id);
  }

  /**
   * Menolak permohonan reservasi berstatus PENDING oleh petugas (STAFF) (FR-RES-05 & RULE-RES-08).
   * Alasan penolakan (reason) wajib diisi.
   */
  async reject(
    staffId: string,
    id: string,
    dto: RejectReservationDto,
    now: Date = new Date(),
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new NotFoundException('Reservasi tidak ditemukan.');
    }

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'Hanya permohonan reservasi berstatus PENDING yang dapat ditolak.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reservation.updateMany({
        where: { id, status: ReservationStatus.PENDING },
        data: {
          status: ReservationStatus.REJECTED,
          decisionReason: dto.reason,
          processedById: staffId,
          decidedAt: now,
        },
      });

      if (changed.count !== 1) {
        throw new ConflictException(
          'Reservasi sudah diproses oleh petugas atau sistem.',
        );
      }

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: 'RESERVATION_REJECTED',
          entityType: 'RESERVATION',
          entityId: id,
          metadata: {
            reason: dto.reason,
            previousStatus: reservation.status,
          },
        },
      });
    });

    return this.getStaffDetail(id);
  }

  /**
   * Membatalkan reservasi APPROVED oleh petugas (STAFF) (FR-RES-11).
   * Alasan pembatalan (reason) wajib diisi.
   */
  async cancelByStaff(
    staffId: string,
    id: string,
    dto: CancelStaffReservationDto,
    now: Date = new Date(),
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new NotFoundException('Reservasi tidak ditemukan.');
    }

    if (reservation.status !== ReservationStatus.APPROVED) {
      throw new BadRequestException(
        'Hanya reservasi berstatus APPROVED yang dapat dibatalkan oleh petugas. Gunakan reject untuk reservasi PENDING.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.reservation.updateMany({
        where: { id, status: ReservationStatus.APPROVED },
        data: {
          status: ReservationStatus.CANCELLED_BY_STAFF,
          decisionReason: dto.reason,
          processedById: staffId,
          cancelledAt: now,
          decidedAt: now,
        },
      });

      if (changed.count !== 1) {
        throw new ConflictException(
          'Reservasi sudah diproses oleh petugas atau sistem.',
        );
      }

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: 'RESERVATION_CANCELLED_BY_STAFF',
          entityType: 'RESERVATION',
          entityId: id,
          metadata: {
            reason: dto.reason,
            previousStatus: reservation.status,
          },
        },
      });
    });

    return this.getStaffDetail(id);
  }

  /**
   * Menolak otomatis seluruh permohonan reservasi PENDING yang telah melewati batas tenggat evaluasi SLA (FR-RES-08 & RULE-RES-04).
   * - Menyeleksi reservasi PENDING dengan decisionDeadline <= now.
   * - Memperbarui status menjadi REJECTED secara transaksional ($transaction).
   * - Mencatat mutasi ke audit_logs dengan action RESERVATION_AUTO_REJECTED (actorId: null).
   */
  async autoRejectExpiredReservations(now: Date = new Date()): Promise<number> {
    const expiredReservations = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        decisionDeadline: {
          lte: now,
        },
      },
      select: {
        id: true,
        decisionDeadline: true,
      },
    });

    if (expiredReservations.length === 0) {
      return 0;
    }

    const reason =
      'Ditolak otomatis oleh sistem karena melewati batas tenggat evaluasi petugas (SLA Expired).';

    return this.prisma.$transaction(async (tx) => {
      let rejectedCount = 0;
      for (const exp of expiredReservations) {
        const changed = await tx.reservation.updateMany({
          where: {
            id: exp.id,
            status: ReservationStatus.PENDING,
            decisionDeadline: { lte: now },
          },
          data: {
            status: ReservationStatus.REJECTED,
            decidedAt: now,
            decisionReason: reason,
          },
        });

        if (changed.count === 1) {
          rejectedCount += 1;
          await tx.auditLog.create({
            data: {
              actorId: null,
              action: 'RESERVATION_AUTO_REJECTED',
              entityType: 'RESERVATION',
              entityId: exp.id,
              metadata: {
                reason,
                decisionDeadline: exp.decisionDeadline,
                evaluatedAt: now.toISOString(),
              },
            },
          });
        }
      }

      return rejectedCount;
    });
  }

  async completeFinishedReservations(now: Date = new Date()): Promise<number> {
    const candidates = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.APPROVED,
        usageDate: { lte: this.reservationDateStartInJakarta(now) },
      },
      select: {
        id: true,
        usageDate: true,
        endTime: true,
      },
    });

    const finished = candidates.filter(
      (reservation) =>
        this.reservationEndAtInJakarta(
          reservation.usageDate,
          reservation.endTime,
        ) <= now,
    );

    if (finished.length === 0) {
      return 0;
    }

    return this.prisma.$transaction(async (tx) => {
      let completedCount = 0;
      for (const reservation of finished) {
        const changed = await tx.reservation.updateMany({
          where: { id: reservation.id, status: ReservationStatus.APPROVED },
          data: { status: ReservationStatus.COMPLETED },
        });

        if (changed.count === 1) {
          completedCount += 1;
          await tx.auditLog.create({
            data: {
              actorId: null,
              action: 'RESERVATION_COMPLETED',
              entityType: 'RESERVATION',
              entityId: reservation.id,
              metadata: {
                previousStatus: ReservationStatus.APPROVED,
                completedAt: now.toISOString(),
              },
            },
          });
        }
      }

      return completedCount;
    });
  }
}
