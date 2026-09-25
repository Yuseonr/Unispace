import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FacilityStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { jakartaReservationBoundary } from '../utils/jakarta-time.util';

/** Aktivasi/nonaktif unit fasilitas beserta histori dan dampak reservasinya. */
@Injectable()
export class FacilityStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async adminUpdateUnitStatus(
    adminId: string,
    facilityId: string,
    newStatus: FacilityStatus,
  ) {
    if (newStatus === FacilityStatus.IN_MAINTENANCE) {
      throw new BadRequestException(
        'Status IN_MAINTENANCE ditentukan otomatis dari periode perbaikan.',
      );
    }

    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      include: {
        facilityGroup: { select: { name: true, reservationMode: true } },
      },
    });
    if (!facility) {
      throw new NotFoundException('Unit fasilitas tidak ditemukan.');
    }
    if (
      facility.status === newStatus &&
      newStatus === FacilityStatus.NONACTIVE
    ) {
      return facility;
    }

    const now = new Date();
    if (newStatus === FacilityStatus.NONACTIVE) {
      const boundary = jakartaReservationBoundary(now);
      const activeApproved = await this.prisma.reservation.findFirst({
        where: {
          status: 'APPROVED',
          OR: [{ facilityId }, { items: { some: { facilityId } } }],
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
        const updated = await tx.facility.update({
          where: { id: facilityId },
          data: { status: FacilityStatus.NONACTIVE },
        });
        await tx.reservation.updateMany({
          where: { status: 'PENDING', facilityId },
          data: {
            status: 'REJECTED',
            decisionReason: 'Fasilitas dinonaktifkan oleh administrator.',
            decidedAt: now,
            processedById: null,
          },
        });
        await tx.facilityStatusHistory.create({
          data: {
            facilityId,
            status: FacilityStatus.NONACTIVE,
            changedById: adminId,
            effectiveAt: now,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_STATUS_DEACTIVATED',
            entityType: 'FACILITY',
            entityId: facilityId,
            metadata: {
              assetCode: facility.assetCode,
              fromStatus: facility.status,
              toStatus: FacilityStatus.NONACTIVE,
            },
          },
        });
        return updated;
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const activeMaintenance = await tx.maintenancePeriod.findFirst({
        where: {
          facilityId,
          startAt: { lte: now },
          endAt: { gt: now },
        },
        select: { id: true },
      });
      const effectiveStatus = activeMaintenance
        ? FacilityStatus.IN_MAINTENANCE
        : FacilityStatus.ACTIVE;

      if (facility.status === effectiveStatus) {
        return facility;
      }

      const updated = await tx.facility.update({
        where: { id: facilityId },
        data: { status: effectiveStatus },
      });
      await tx.facilityStatusHistory.create({
        data: {
          facilityId,
          status: effectiveStatus,
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
            fromStatus: facility.status,
            toStatus: effectiveStatus,
            activeMaintenance: Boolean(activeMaintenance),
          },
        },
      });
      return updated;
    });
  }
}
