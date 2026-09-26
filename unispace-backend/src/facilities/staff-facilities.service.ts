import { Injectable } from '@nestjs/common';
import { FacilityStatus, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { REPORT_CATEGORY_LABELS } from '../reports/reports.constants';
import { ListStaffMaintenanceDto } from './dto/staff/list-staff-maintenance.dto';

/** Query operasional khusus petugas; tidak membuka CRUD master fasilitas. */
@Injectable()
export class StaffFacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMaintenance(query: ListStaffMaintenanceDto, now = new Date()) {
    const stateWhere: Prisma.MaintenancePeriodWhereInput =
      query.state === 'ACTIVE'
        ? { startAt: { lte: now }, endAt: { gt: now } }
        : query.state === 'SCHEDULED'
          ? { startAt: { gt: now } }
          : { endAt: { gt: now } };
    const where: Prisma.MaintenancePeriodWhereInput = {
      ...stateWhere,
      facility: { status: { not: FacilityStatus.NONACTIVE } },
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.maintenancePeriod.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          note: true,
          startAt: true,
          endAt: true,
          facility: {
            select: {
              id: true,
              assetCode: true,
              name: true,
              facilityGroup: {
                select: {
                  id: true,
                  name: true,
                  reservationMode: true,
                  facilityArea: { select: { id: true, name: true } },
                },
              },
            },
          },
          report: {
            select: {
              id: true,
              reportNumber: true,
              status: true,
              category: true,
            },
          },
        },
      }),
      this.prisma.maintenancePeriod.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        endAt: item.endAt.toISOString(),
        report: {
          ...item.report,
          categoryLabel: REPORT_CATEGORY_LABELS[item.report.category],
        },
        startAt: item.startAt.toISOString(),
        state: item.startAt <= now && item.endAt > now ? 'ACTIVE' : 'SCHEDULED',
      })),
      limit: query.limit,
      page: query.page,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }
}
