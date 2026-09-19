import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, ReservationMode } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
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
}
