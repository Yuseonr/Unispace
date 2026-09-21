import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FacilityStatus,
  type Prisma,
  ReservationMode,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateFacilityGroupDto } from './dto/create-facility-group.dto';
import { CreateFacilityUnitDto } from './dto/create-facility-unit.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { QueryFacilitiesDto } from './dto/query-facilities.dto';
import { UpdateFacilityGroupDto } from './dto/update-facility-group.dto';

// ---------------------------------------------------------------------------
// Helper Waktu Jakarta (Asia/Jakarta)
// ---------------------------------------------------------------------------

function jakartaReservationBoundary(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);

  const numberPart = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Unable to determine Jakarta ${type}.`);
    }
    return Number(value);
  };

  const year = numberPart('year');
  const month = numberPart('month');
  const day = numberPart('day');
  const hour = numberPart('hour');
  const minute = numberPart('minute');
  const second = numberPart('second');

  return {
    usageDate: new Date(Date.UTC(year, month - 1, day)),
    endTime: new Date(Date.UTC(1970, 0, 1, hour, minute, second)),
  };
}

// ---------------------------------------------------------------------------
// Projection: data yang dikembalikan ke publik — tanpa data pribadi pemesan
// ---------------------------------------------------------------------------

const facilityGroupPublicSelect = {
  id: true,
  name: true,
  reservationMode: true,
  capacity: true,
  description: true,
  primaryImageUrl: true,
  facilityType: { select: { id: true, name: true } },
  location: { select: { id: true, name: true, detail: true } },
} satisfies Prisma.FacilityGroupSelect;

const facilityUnitPublicSelect = {
  id: true,
  assetCode: true,
  name: true,
  capacity: true,
  description: true,
  primaryImageUrl: true,
  status: true,
  facilityGroup: {
    select: {
      id: true,
      name: true,
      reservationMode: true,
      facilityType: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, detail: true } },
    },
  },
} satisfies Prisma.FacilitySelect;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class FacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Master Data ──────────────────────────────────────────────────────────

  /** Daftar tipe fasilitas — untuk dropdown filter katalog */
  async listTypes() {
    return this.prisma.facilityType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /** Daftar lokasi/gedung — untuk dropdown filter katalog */
  async listLocations() {
    return this.prisma.location.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // ─── Katalog Publik ───────────────────────────────────────────────────────

  /**
   * FR-FAC-01 & FR-FAC-02
   * Mengembalikan daftar fasilitas aktif yang dapat dilihat publik.
   *
   * Untuk mode EXCLUSIVE: tiap unit ruang/area tampil sebagai kartu tersendiri.
   * Untuk mode QUANTITY:  kelompok alat tampil sebagai satu kartu bersama
   *                       dengan jumlah unit fisik yang masih aktif.
   */
  async list(query: QueryFacilitiesDto) {
    const skip = (query.page - 1) * query.limit;

    // ── EXCLUSIVE: ruang/area — filter pada unit fisik (Facility) ─────────
    const exclusiveWhere: Prisma.FacilityWhereInput = {
      status: 'ACTIVE',
      facilityGroup: {
        reservationMode: ReservationMode.EXCLUSIVE,
        ...(query.facilityTypeId
          ? { facilityTypeId: query.facilityTypeId }
          : {}),
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                {
                  description: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      ...(query.minCapacity !== undefined
        ? { capacity: { gte: query.minCapacity } }
        : {}),
    };

    // ── QUANTITY: kelompok alat — filter pada FacilityGroup ──────────────
    const quantityGroupWhere: Prisma.FacilityGroupWhereInput = {
      reservationMode: ReservationMode.QUANTITY,
      ...(query.facilityTypeId
        ? { facilityTypeId: query.facilityTypeId }
        : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.minCapacity !== undefined
        ? { capacity: { gte: query.minCapacity } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      // hanya tampil jika ada minimal 1 unit aktif
      facilities: { some: { status: 'ACTIVE' } },
    };

    const [exclusiveFacilities, quantityGroups, exclusiveCount, quantityCount] =
      await Promise.all([
        this.prisma.facility.findMany({
          where: exclusiveWhere,
          select: facilityUnitPublicSelect,
          orderBy: [{ facilityGroup: { name: 'asc' } }, { assetCode: 'asc' }],
          skip,
          take: query.limit,
        }),
        this.prisma.facilityGroup.findMany({
          where: quantityGroupWhere,
          select: {
            ...facilityGroupPublicSelect,
            // hitung unit aktif untuk ditampilkan di kartu
            _count: { select: { facilities: { where: { status: 'ACTIVE' } } } },
          },
          orderBy: { name: 'asc' },
          skip,
          take: query.limit,
        }),
        this.prisma.facility.count({ where: exclusiveWhere }),
        this.prisma.facilityGroup.count({ where: quantityGroupWhere }),
      ]);

    const exclusiveCards = exclusiveFacilities.map((f) => ({
      kind: 'EXCLUSIVE' as const,
      id: f.id,
      assetCode: f.assetCode,
      name: f.name ?? f.facilityGroup.name,
      facilityType: f.facilityGroup.facilityType,
      location: f.facilityGroup.location,
      capacity: f.capacity,
      description: f.description,
      primaryImageUrl: f.primaryImageUrl,
      status: f.status,
    }));

    const quantityCards = quantityGroups.map((g) => ({
      kind: 'QUANTITY' as const,
      id: g.id,
      name: g.name,
      facilityType: g.facilityType,
      location: g.location,
      capacity: g.capacity,
      description: g.description,
      primaryImageUrl: g.primaryImageUrl,
      activeUnits: g._count.facilities,
    }));

    return {
      exclusive: {
        data: exclusiveCards,
        total: exclusiveCount,
        page: query.page,
        limit: query.limit,
      },
      quantity: {
        data: quantityCards,
        total: quantityCount,
        page: query.page,
        limit: query.limit,
      },
    };
  }

  /**
   * FR-FAC-03
   * Detail satu fasilitas untuk publik.
   * - EXCLUSIVE: detail unit ruang/area dari tabel Facility.
   * - QUANTITY:  detail kelompok alat dari tabel FacilityGroup (informasi bersama).
   *
   * @param id  - UUID unit Facility (EXCLUSIVE) atau FacilityGroup (QUANTITY)
   * @param kind - 'unit' (default) | 'group'
   */
  async detail(id: string, kind: 'unit' | 'group' = 'unit') {
    if (kind === 'group') {
      const group = await this.prisma.facilityGroup.findFirst({
        where: { id, reservationMode: ReservationMode.QUANTITY },
        select: {
          ...facilityGroupPublicSelect,
          _count: { select: { facilities: { where: { status: 'ACTIVE' } } } },
        },
      });
      if (!group) {
        throw new NotFoundException('Fasilitas tidak ditemukan.');
      }
      return {
        kind: 'QUANTITY' as const,
        id: group.id,
        name: group.name,
        facilityType: group.facilityType,
        location: group.location,
        capacity: group.capacity,
        description: group.description,
        primaryImageUrl: group.primaryImageUrl,
        activeUnits: group._count.facilities,
      };
    }

    // Default: EXCLUSIVE unit
    const facility = await this.prisma.facility.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        facilityGroup: { reservationMode: ReservationMode.EXCLUSIVE },
      },
      select: facilityUnitPublicSelect,
    });
    if (!facility) {
      throw new NotFoundException('Fasilitas tidak ditemukan.');
    }

    return {
      kind: 'EXCLUSIVE' as const,
      id: facility.id,
      assetCode: facility.assetCode,
      name: facility.name ?? facility.facilityGroup.name,
      facilityType: facility.facilityGroup.facilityType,
      location: facility.facilityGroup.location,
      capacity: facility.capacity,
      description: facility.description,
      primaryImageUrl: facility.primaryImageUrl,
      status: facility.status,
    };
  }

  // ─── Ketersediaan Slot 30 Menit (FR-FAC-04 & FR-FAC-05) ───────────────────

  /**
   * Mengembalikan 26 kartu slot waktu 30 menit (07.00–20.00 WIB)
   * untuk tanggal tertentu tanpa membocorkan identitas/tujuan peminjam.
   */
  async getAvailability(id: string, query: QueryAvailabilityDto) {
    const { date, kind = 'unit' } = query;
    const [year, month, day] = date.split('-').map(Number);
    const checkDate = new Date(Date.UTC(year, month - 1, day, 5, 0, 0)); // Siang hari WIB
    const dayOfWeek = checkDate.getUTCDay();
    const isOperationalDay = dayOfWeek >= 1 && dayOfWeek <= 5; // Senin–Jumat

    const usageDate = new Date(Date.UTC(year, month - 1, day));
    const dayStartUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)); // 07:00 WIB
    const dayEndUtc = new Date(Date.UTC(year, month - 1, day, 13, 0, 0)); // 20:00 WIB

    if (kind === 'group') {
      const group = await this.prisma.facilityGroup.findFirst({
        where: { id, reservationMode: ReservationMode.QUANTITY },
        include: {
          facilities: {
            where: { status: 'ACTIVE' },
            select: { id: true, assetCode: true },
          },
        },
      });
      if (!group) {
        throw new NotFoundException('Kelompok fasilitas tidak ditemukan.');
      }

      const activeUnitsCount = group.facilities.length;
      const activeUnitIds = group.facilities.map((f) => f.id);

      const [approvedReservations, maintenancePeriods] = await Promise.all([
        this.prisma.reservation.findMany({
          where: {
            facilityGroupId: id,
            usageDate,
            status: 'APPROVED',
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

        if (!isOperationalDay) {
          return {
            slotIndex: i,
            startTime: startTimeStr,
            endTime: endTimeStr,
            available: false,
            availableUnits: 0,
            totalUnits: activeUnitsCount,
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

        const maintenanceUnitIds = new Set(
          maintenancePeriods
            .filter((m) => m.startAt < slotEndUtc && m.endAt > slotStartUtc)
            .map((m) => m.facilityId),
        );
        const maintenanceCount = maintenanceUnitIds.size;

        const reservedCount = approvedReservations
          .filter(
            (r) =>
              r.startTime < slotEndTimeDate && r.endTime > slotStartTimeDate,
          )
          .reduce((sum, r) => sum + r.requestedQuantity, 0);

        const availableUnits = Math.max(
          0,
          activeUnitsCount - maintenanceCount - reservedCount,
        );

        return {
          slotIndex: i,
          startTime: startTimeStr,
          endTime: endTimeStr,
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

    // Default: EXCLUSIVE unit
    const facility = await this.prisma.facility.findFirst({
      where: {
        id,
        facilityGroup: { reservationMode: ReservationMode.EXCLUSIVE },
      },
      select: {
        id: true,
        assetCode: true,
        name: true,
        status: true,
        facilityGroup: { select: { name: true } },
      },
    });

    if (!facility) {
      throw new NotFoundException('Fasilitas tidak ditemukan.');
    }

    if (facility.status !== 'ACTIVE') {
      return {
        kind: 'EXCLUSIVE' as const,
        facilityId: facility.id,
        assetCode: facility.assetCode,
        name: facility.name ?? facility.facilityGroup.name,
        date,
        isOperationalDay,
        status: facility.status,
        slots: Array.from({ length: 26 }, (_, i) => {
          const startHour = 7 + Math.floor(i / 2);
          const startMin = (i % 2) * 30;
          const endHour = 7 + Math.floor((i + 1) / 2);
          const endMin = ((i + 1) % 2) * 30;
          const pad = (n: number) => n.toString().padStart(2, '0');
          return {
            slotIndex: i,
            startTime: `${pad(startHour)}:${pad(startMin)}`,
            endTime: `${pad(endHour)}:${pad(endMin)}`,
            available: false,
            reason: 'FACILITY_INACTIVE',
          };
        }),
      };
    }

    const [approvedReservations, maintenancePeriods] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          facilityId: id,
          usageDate,
          status: 'APPROVED',
        },
        select: {
          startTime: true,
          endTime: true,
        },
      }),
      this.prisma.maintenancePeriod.findMany({
        where: {
          facilityId: id,
          startAt: { lt: dayEndUtc },
          endAt: { gt: dayStartUtc },
        },
        select: {
          startAt: true,
          endAt: true,
        },
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

      if (!isOperationalDay) {
        return {
          slotIndex: i,
          startTime: startTimeStr,
          endTime: endTimeStr,
          available: false,
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

      const isMaintenance = maintenancePeriods.some(
        (m) => m.startAt < slotEndUtc && m.endAt > slotStartUtc,
      );
      if (isMaintenance) {
        return {
          slotIndex: i,
          startTime: startTimeStr,
          endTime: endTimeStr,
          available: false,
          reason: 'MAINTENANCE',
        };
      }

      const isReserved = approvedReservations.some(
        (r) => r.startTime < slotEndTimeDate && r.endTime > slotStartTimeDate,
      );
      if (isReserved) {
        return {
          slotIndex: i,
          startTime: startTimeStr,
          endTime: endTimeStr,
          available: false,
          reason: 'RESERVED',
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
      kind: 'EXCLUSIVE' as const,
      facilityId: facility.id,
      assetCode: facility.assetCode,
      name: facility.name ?? facility.facilityGroup.name,
      date,
      isOperationalDay,
      slots,
    };
  }

  // ─── Admin Master Facilities (FR-FAC-06 & FR-FAC-08) ──────────────────────

  /**
   * Admin membuat kelompok fasilitas baru.
   * Jika mode EXCLUSIVE, unit fisik awal otomatis dibuat jika assetCode disertakan.
   */
  async adminCreateGroup(adminId: string, input: CreateFacilityGroupDto) {
    // Validasi existence tipe fasilitas
    const typeExists = await this.prisma.facilityType.findUnique({
      where: { id: input.facilityTypeId },
    });
    if (!typeExists) {
      throw new NotFoundException('Tipe fasilitas tidak ditemukan.');
    }

    if (input.locationId) {
      const locExists = await this.prisma.location.findUnique({
        where: { id: input.locationId },
      });
      if (!locExists) {
        throw new NotFoundException('Lokasi tidak ditemukan.');
      }
    }

    if (input.reservationMode === ReservationMode.EXCLUSIVE && input.assetCode) {
      const existingAsset = await this.prisma.facility.findUnique({
        where: { assetCode: input.assetCode },
      });
      if (existingAsset) {
        throw new ConflictException(
          `Kode aset "${input.assetCode}" sudah digunakan.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.facilityGroup.create({
        data: {
          name: input.name,
          facilityTypeId: input.facilityTypeId,
          reservationMode: input.reservationMode,
          locationId: input.locationId,
          capacity: input.capacity,
          description: input.description,
          primaryImageUrl: input.primaryImageUrl,
        },
        include: {
          facilityType: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });

      let initialUnit = null;
      if (
        input.reservationMode === ReservationMode.EXCLUSIVE &&
        input.assetCode
      ) {
        initialUnit = await tx.facility.create({
          data: {
            facilityGroupId: group.id,
            assetCode: input.assetCode,
            name: input.name,
            locationId: input.locationId,
            capacity: input.capacity,
            description: input.description,
            primaryImageUrl: input.primaryImageUrl,
            status: 'ACTIVE',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'FACILITY_GROUP_CREATED',
          entityType: 'FACILITY_GROUP',
          entityId: group.id,
          metadata: {
            name: group.name,
            reservationMode: group.reservationMode,
            initialAssetCode: input.assetCode ?? null,
          },
        },
      });

      return {
        ...group,
        initialUnit,
      };
    });
  }

  /**
   * Admin memperbarui metadata kelompok fasilitas (nama, tipe, lokasi, foto utama, dsb).
   */
  async adminUpdateGroup(
    adminId: string,
    groupId: string,
    input: UpdateFacilityGroupDto,
  ) {
    const existingGroup = await this.prisma.facilityGroup.findUnique({
      where: { id: groupId },
    });
    if (!existingGroup) {
      throw new NotFoundException('Kelompok fasilitas tidak ditemukan.');
    }

    if (input.facilityTypeId) {
      const typeExists = await this.prisma.facilityType.findUnique({
        where: { id: input.facilityTypeId },
      });
      if (!typeExists) {
        throw new NotFoundException('Tipe fasilitas tidak ditemukan.');
      }
    }

    if (input.locationId) {
      const locExists = await this.prisma.location.findUnique({
        where: { id: input.locationId },
      });
      if (!locExists) {
        throw new NotFoundException('Lokasi tidak ditemukan.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.facilityGroup.update({
        where: { id: groupId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.facilityTypeId !== undefined
            ? { facilityTypeId: input.facilityTypeId }
            : {}),
          ...(input.locationId !== undefined
            ? { locationId: input.locationId }
            : {}),
          ...(input.capacity !== undefined
            ? { capacity: input.capacity }
            : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.primaryImageUrl !== undefined
            ? { primaryImageUrl: input.primaryImageUrl }
            : {}),
        },
        include: {
          facilityType: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'FACILITY_GROUP_UPDATED',
          entityType: 'FACILITY_GROUP',
          entityId: groupId,
          metadata: { changes: input as unknown as Prisma.InputJsonValue },
        },
      });

      return updated;
    });
  }

  /**
   * Admin menambah unit fisik baru dengan asset_code unik ke dalam kelompok fasilitas.
   */
  async adminCreateUnit(adminId: string, input: CreateFacilityUnitDto) {
    const group = await this.prisma.facilityGroup.findUnique({
      where: { id: input.facilityGroupId },
    });
    if (!group) {
      throw new NotFoundException('Kelompok fasilitas tidak ditemukan.');
    }

    const existingAsset = await this.prisma.facility.findUnique({
      where: { assetCode: input.assetCode },
    });
    if (existingAsset) {
      throw new ConflictException(
        `Kode aset "${input.assetCode}" sudah digunakan.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.facility.create({
        data: {
          facilityGroupId: input.facilityGroupId,
          assetCode: input.assetCode,
          name: input.name ?? null,
          locationId: group.locationId,
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'FACILITY_UNIT_CREATED',
          entityType: 'FACILITY',
          entityId: unit.id,
          metadata: {
            assetCode: unit.assetCode,
            facilityGroupId: group.id,
          },
        },
      });

      return unit;
    });
  }

  /**
   * Admin melihat daftar semua kelompok dan unit fasilitas (termasuk yang nonaktif).
   */
  async adminList() {
    return this.prisma.facilityGroup.findMany({
      include: {
        facilityType: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        facilities: {
          select: {
            id: true,
            assetCode: true,
            name: true,
            status: true,
            createdAt: true,
          },
          orderBy: { assetCode: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * FR-FAC-07: Admin mengubah status unit fasilitas (ACTIVE <-> NONACTIVE).
   * Menolak aksi jika masih ada reservasi APPROVED yang jam selesainya belum terlewati.
   * Menolak pengajuan PENDING secara otomatis jika penonaktifan berhasil.
   * Mencatat ke FacilityStatusHistory dan AuditLog.
   */
  async adminUpdateUnitStatus(
    adminId: string,
    facilityId: string,
    newStatus: FacilityStatus,
  ) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      include: {
        facilityGroup: { select: { name: true, reservationMode: true } },
      },
    });

    if (!facility) {
      throw new NotFoundException('Unit fasilitas tidak ditemukan.');
    }

    if (facility.status === newStatus) {
      return facility;
    }

    const now = new Date();

    if (newStatus === FacilityStatus.NONACTIVE) {
      const boundary = jakartaReservationBoundary(now);

      // Cek apakah masih ada reservasi APPROVED yang belum selesai
      // (Bisa terhubung via facilityId langsung atau via reservationItems)
      const activeApproved = await this.prisma.reservation.findFirst({
        where: {
          status: 'APPROVED',
          OR: [
            { facilityId },
            { items: { some: { facilityId } } },
          ],
          AND: [
            {
              OR: [
                { usageDate: { gt: boundary.usageDate } },
                {
                  usageDate: boundary.usageDate,
                  endTime: { gte: boundary.endTime },
                },
              ],
            },
          ],
        },
      });

      if (activeApproved) {
        throw new BadRequestException(
          'Tidak dapat menonaktifkan fasilitas: masih terdapat reservasi disetujui (APPROVED) yang belum selesai. ' +
            'Silakan minta petugas membatalkan reservasi tersebut terlebih dahulu.',
        );
      }

      return this.prisma.$transaction(async (tx) => {
        // 1. Update status unit fasilitas
        const updated = await tx.facility.update({
          where: { id: facilityId },
          data: { status: FacilityStatus.NONACTIVE },
        });

        // 2. Tolak reservasi PENDING yang mengarah ke fasilitas ini
        await tx.reservation.updateMany({
          where: {
            status: 'PENDING',
            facilityId,
          },
          data: {
            status: 'REJECTED',
            decisionReason: 'Fasilitas dinonaktifkan oleh administrator.',
            decidedAt: now,
            processedById: null,
          },
        });

        // 3. Catat ke FacilityStatusHistory
        await tx.facilityStatusHistory.create({
          data: {
            facilityId,
            status: FacilityStatus.NONACTIVE,
            changedById: adminId,
            effectiveAt: now,
          },
        });

        // 4. Catat ke AuditLog
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_STATUS_DEACTIVATED',
            entityType: 'FACILITY',
            entityId: facilityId,
            metadata: {
              assetCode: facility.assetCode,
              fromStatus: FacilityStatus.ACTIVE,
              toStatus: FacilityStatus.NONACTIVE,
            },
          },
        });

        return updated;
      });
    }

    // Mengaktifkan kembali (ACTIVE)
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.facility.update({
        where: { id: facilityId },
        data: { status: FacilityStatus.ACTIVE },
      });

      await tx.facilityStatusHistory.create({
        data: {
          facilityId,
          status: FacilityStatus.ACTIVE,
          changedById: adminId,
          effectiveAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'FACILITY_STATUS_ACTIVATED',
          entityType: 'FACILITY',
          entityId: facilityId,
          metadata: {
            assetCode: facility.assetCode,
            fromStatus: FacilityStatus.NONACTIVE,
            toStatus: FacilityStatus.ACTIVE,
          },
        },
      });

      return updated;
    });
  }
}
