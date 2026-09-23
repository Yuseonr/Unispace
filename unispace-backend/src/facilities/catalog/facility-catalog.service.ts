import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FacilityStatus,
  type Prisma,
  ReservationMode,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QueryFacilitiesDto } from '../dto/catalog';

// Projection tetap berada bersama service katalog, bukan file query terpisah.
const facilityGroupPublicSelect = {
  id: true,
  name: true,
  reservationMode: true,
  locationDetail: true,
  capacity: true,
  description: true,
  primaryImageUrl: true,
  facilityType: { select: { id: true, name: true } },
  facilityArea: { select: { id: true, code: true, name: true } },
} satisfies Prisma.FacilityGroupSelect;

const facilityUnitPublicSelect = {
  id: true,
  assetCode: true,
  name: true,
  capacity: true,
  description: true,
  primaryImageUrl: true,
  status: true,
  maintenancePeriods: { select: { startAt: true, endAt: true } },
  facilityGroup: {
    select: {
      id: true,
      name: true,
      reservationMode: true,
      locationDetail: true,
      facilityType: { select: { id: true, name: true } },
      facilityArea: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.FacilitySelect;

/** Query read-only yang membentuk kartu dan detail katalog publik. */
@Injectable()
export class FacilityCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryFacilitiesDto) {
    const skip = (query.page - 1) * query.limit;
    const now = new Date();
    const exclusiveWhere: Prisma.FacilityWhereInput = {
      status: FacilityStatus.ACTIVE,
      facilityGroup: {
        reservationMode: ReservationMode.EXCLUSIVE,
        ...(query.facilityTypeId
          ? { facilityTypeId: query.facilityTypeId }
          : {}),
        ...(query.facilityAreaId
          ? { facilityAreaId: query.facilityAreaId }
          : {}),
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
                {
                  locationDetail: {
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
    const quantityGroupWhere: Prisma.FacilityGroupWhereInput = {
      reservationMode: ReservationMode.QUANTITY,
      ...(query.facilityTypeId ? { facilityTypeId: query.facilityTypeId } : {}),
      ...(query.facilityAreaId ? { facilityAreaId: query.facilityAreaId } : {}),
      ...(query.minCapacity !== undefined
        ? { capacity: { gte: query.minCapacity } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              {
                locationDetail: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      facilities: { some: { status: FacilityStatus.ACTIVE } },
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
            _count: {
              select: {
                facilities: { where: { status: FacilityStatus.ACTIVE } },
              },
            },
            facilities: {
              where: { status: FacilityStatus.ACTIVE },
              select: {
                maintenancePeriods: {
                  where: { startAt: { lte: now }, endAt: { gt: now } },
                  select: { id: true },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
          skip,
          take: query.limit,
        }),
        this.prisma.facility.count({ where: exclusiveWhere }),
        this.prisma.facilityGroup.count({ where: quantityGroupWhere }),
      ]);

    return {
      exclusive: {
        data: exclusiveFacilities.map((facility) => ({
          kind: 'EXCLUSIVE' as const,
          id: facility.id,
          assetCode: facility.assetCode,
          name: facility.name ?? facility.facilityGroup.name,
          facilityType: facility.facilityGroup.facilityType,
          facilityArea: facility.facilityGroup.facilityArea,
          locationDetail: facility.facilityGroup.locationDetail,
          capacity: facility.capacity,
          description: facility.description,
          primaryImageUrl: facility.primaryImageUrl,
          status: this.publicUnitStatus(
            facility.status,
            facility.maintenancePeriods,
            now,
          ),
        })),
        total: exclusiveCount,
        page: query.page,
        limit: query.limit,
      },
      quantity: {
        data: quantityGroups.map((group) => ({
          kind: 'QUANTITY' as const,
          id: group.id,
          name: group.name,
          facilityType: group.facilityType,
          facilityArea: group.facilityArea,
          locationDetail: group.locationDetail,
          capacity: group.capacity,
          description: group.description,
          primaryImageUrl: group.primaryImageUrl,
          activeUnits: group._count.facilities,
          status:
            group.facilities.length > 0 &&
            group.facilities.every((unit) => unit.maintenancePeriods.length > 0)
              ? 'MAINTENANCE'
              : FacilityStatus.ACTIVE,
        })),
        total: quantityCount,
        page: query.page,
        limit: query.limit,
      },
    };
  }

  async detail(id: string, kind: 'unit' | 'group' = 'unit') {
    const now = new Date();
    if (kind === 'group') {
      const [group, nextMaintenance] = await Promise.all([
        this.prisma.facilityGroup.findFirst({
          where: {
            id,
            reservationMode: ReservationMode.QUANTITY,
            facilities: { some: { status: FacilityStatus.ACTIVE } },
          },
          select: {
            ...facilityGroupPublicSelect,
            _count: {
              select: {
                facilities: { where: { status: FacilityStatus.ACTIVE } },
              },
            },
            facilities: {
              where: { status: FacilityStatus.ACTIVE },
              select: {
                maintenancePeriods: {
                  where: { startAt: { lte: now }, endAt: { gt: now } },
                  select: { id: true },
                },
              },
            },
          },
        }),
        this.prisma.maintenancePeriod.findFirst({
          where: {
            startAt: { gt: now },
            facility: { facilityGroupId: id, status: FacilityStatus.ACTIVE },
          },
          select: { startAt: true, endAt: true },
          orderBy: { startAt: 'asc' },
        }),
      ]);
      if (!group) {
        throw new NotFoundException('Fasilitas tidak ditemukan.');
      }
      return {
        kind: 'QUANTITY' as const,
        id: group.id,
        name: group.name,
        facilityType: group.facilityType,
        facilityArea: group.facilityArea,
        locationDetail: group.locationDetail,
        capacity: group.capacity,
        description: group.description,
        primaryImageUrl: group.primaryImageUrl,
        activeUnits: group._count.facilities,
        status:
          group.facilities.length > 0 &&
          group.facilities.every((unit) => unit.maintenancePeriods.length > 0)
            ? 'MAINTENANCE'
            : FacilityStatus.ACTIVE,
        nextMaintenance: nextMaintenance ?? undefined,
      };
    }

    const facility = await this.prisma.facility.findFirst({
      where: {
        id,
        status: FacilityStatus.ACTIVE,
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
      facilityArea: facility.facilityGroup.facilityArea,
      locationDetail: facility.facilityGroup.locationDetail,
      capacity: facility.capacity,
      description: facility.description,
      primaryImageUrl: facility.primaryImageUrl,
      status: this.publicUnitStatus(
        facility.status,
        facility.maintenancePeriods,
        now,
      ),
      nextMaintenance: this.nextMaintenance(
        facility.status,
        facility.maintenancePeriods,
        now,
      ),
    };
  }

  private publicUnitStatus(
    status: FacilityStatus,
    maintenancePeriods: Array<{ startAt: Date; endAt: Date }>,
    now: Date,
  ) {
    if (status === FacilityStatus.NONACTIVE) {
      return FacilityStatus.NONACTIVE;
    }
    return maintenancePeriods.some(
      (period) => period.startAt <= now && period.endAt > now,
    )
      ? 'MAINTENANCE'
      : FacilityStatus.ACTIVE;
  }

  private nextMaintenance(
    status: FacilityStatus,
    maintenancePeriods: Array<{ startAt: Date; endAt: Date }>,
    now: Date,
  ) {
    if (status === FacilityStatus.NONACTIVE) {
      return undefined;
    }
    const upcoming = maintenancePeriods.find((period) => period.startAt > now);
    return upcoming
      ? { startAt: upcoming.startAt, endAt: upcoming.endAt }
      : undefined;
  }
}
