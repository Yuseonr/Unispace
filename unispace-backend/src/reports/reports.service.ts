import { Injectable } from '@nestjs/common';
import { FacilityStatus, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { SearchReportFacilitiesDto } from './dto/search-report-facilities.dto';

const reportFacilitySelect = {
  id: true,
  assetCode: true,
  name: true,
  capacity: true,
  description: true,
  primaryImageUrl: true,
  facilityGroup: {
    select: {
      id: true,
      name: true,
    },
  },
  location: {
    select: {
      id: true,
      name: true,
      detail: true,
    },
  },
} satisfies Prisma.FacilitySelect;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchFacilities(query: SearchReportFacilitiesDto) {
    const search = query.search;
    const where: Prisma.FacilityWhereInput = {
      status: FacilityStatus.ACTIVE,
      OR: [
        { assetCode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        {
          facilityGroup: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          location: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ],
    };
    const skip = (query.page - 1) * query.limit;

    const [facilities, total] = await Promise.all([
      this.prisma.facility.findMany({
        where,
        select: reportFacilitySelect,
        orderBy: [{ name: 'asc' }, { assetCode: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.facility.count({ where }),
    ]);

    return {
      items: facilities,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}
