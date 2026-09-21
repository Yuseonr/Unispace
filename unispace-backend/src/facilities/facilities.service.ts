import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, ReservationMode } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { QueryFacilitiesDto } from './dto/query-facilities.dto';

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
}
