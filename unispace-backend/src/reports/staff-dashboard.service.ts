import { Injectable } from '@nestjs/common';
import { ReportStatus, ReservationStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

/** Satu sumber count antrean operasional petugas. */
@Injectable()
export class StaffDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(now = new Date()) {
    const [
      pendingReservations,
      overdueDecision,
      newReports,
      inProgressReports,
    ] = await Promise.all([
      this.prisma.reservation.count({
        where: { status: ReservationStatus.PENDING },
      }),
      this.prisma.reservation.count({
        where: {
          status: ReservationStatus.PENDING,
          decisionDeadline: { lt: now },
        },
      }),
      this.prisma.facilityReport.count({
        where: { status: ReportStatus.NEW },
      }),
      this.prisma.facilityReport.count({
        where: { status: ReportStatus.IN_PROGRESS },
      }),
    ]);

    return {
      reservations: {
        pending: pendingReservations,
        overdueDecision,
      },
      reports: {
        new: newReports,
        inProgress: inProgressReports,
      },
      generatedAt: now.toISOString(),
    };
  }
}
