import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FacilityStatus,
  Prisma,
  ReservationMode,
  ReservationStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { jakartaReservationBoundary } from '../utils/jakarta-time.util';
import { QuantityReservationReconciliationService } from '../quantity-reservation-reconciliation.service';

/** Aktivasi/nonaktif unit fasilitas beserta histori dan dampak reservasinya. */
@Injectable()
export class FacilityStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: QuantityReservationReconciliationService,
  ) {}

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!isSerializationConflict || attempt === 3) {
          throw error;
        }
      }
    }

    throw new BadRequestException(
      'Perubahan status fasilitas tidak dapat diproses. Silakan coba kembali.',
    );
  }

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
    if (facility.status === newStatus) {
      return facility;
    }

    if (newStatus === FacilityStatus.NONACTIVE) {
      return this.runSerializableTransaction(async (tx) => {
        const now = new Date();
        const current = await tx.facility.findUnique({
          where: { id: facilityId },
          include: {
            facilityGroup: {
              select: { name: true, reservationMode: true },
            },
          },
        });
        if (!current) {
          throw new NotFoundException('Unit fasilitas tidak ditemukan.');
        }
        if (current.status === FacilityStatus.NONACTIVE) {
          return current;
        }

        const pendingDates = await tx.reservation.findMany({
          where:
            current.facilityGroup.reservationMode === ReservationMode.QUANTITY
              ? {
                  facilityGroupId: current.facilityGroupId,
                  status: ReservationStatus.PENDING,
                }
              : {
                  facilityId,
                  status: ReservationStatus.PENDING,
                },
          select: { usageDate: true },
          distinct: ['usageDate'],
        });
        for (const pending of pendingDates) {
          await this.reconciliation.lockAvailabilityDate(
            tx,
            current.facilityGroup.reservationMode === ReservationMode.QUANTITY
              ? 'FACILITY_GROUP'
              : 'FACILITY',
            current.facilityGroup.reservationMode === ReservationMode.QUANTITY
              ? current.facilityGroupId
              : facilityId,
            pending.usageDate,
          );
        }

        const boundary = jakartaReservationBoundary(now);
        const activeApproved = await tx.reservation.findFirst({
          where: {
            status: ReservationStatus.APPROVED,
            OR: [{ facilityId }, { items: { some: { facilityId } } }],
            AND: [
              {
                OR: [
                  { usageDate: { gt: boundary.usageDate } },
                  {
                    usageDate: boundary.usageDate,
                    endTime: { gt: boundary.endTime },
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

        const updatedResult = await tx.facility.updateMany({
          where: {
            id: facilityId,
            status: { not: FacilityStatus.NONACTIVE },
          },
          data: { status: FacilityStatus.NONACTIVE },
        });
        if (updatedResult.count !== 1) {
          throw new BadRequestException(
            'Status fasilitas berubah oleh proses lain. Silakan muat ulang data.',
          );
        }

        if (
          current.facilityGroup.reservationMode === ReservationMode.QUANTITY
        ) {
          for (const pending of pendingDates) {
            await this.reconciliation.rejectInfeasibleQuantityReservations(tx, {
              facilityGroupId: current.facilityGroupId,
              usageDate: pending.usageDate,
              actorId: adminId,
              processedById: null,
              decidedAt: now,
              reason: 'Fasilitas dinonaktifkan oleh administrator.',
              metadata: {
                facilityId,
                rejectionSource: 'FACILITY_DEACTIVATION',
              },
            });
          }
        } else {
          await this.reconciliation.rejectExclusiveReservations(tx, {
            facilityId,
            actorId: adminId,
            processedById: null,
            decidedAt: now,
            reason: 'Fasilitas dinonaktifkan oleh administrator.',
            metadata: { rejectionSource: 'FACILITY_DEACTIVATION' },
          });
        }

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
              fromStatus: current.status,
              toStatus: FacilityStatus.NONACTIVE,
            },
          },
        });

        return {
          ...facility,
          status: FacilityStatus.NONACTIVE,
        };
      });
    }

    return this.runSerializableTransaction(async (tx) => {
      const now = new Date();
      const current = await tx.facility.findUnique({
        where: { id: facilityId },
        include: {
          facilityGroup: {
            select: { name: true, reservationMode: true },
          },
        },
      });
      if (!current) {
        throw new NotFoundException('Unit fasilitas tidak ditemukan.');
      }
      if (current.status === FacilityStatus.ACTIVE) {
        return current;
      }

      const updatedResult = await tx.facility.updateMany({
        where: { id: facilityId, status: current.status },
        data: { status: FacilityStatus.ACTIVE },
      });
      if (updatedResult.count !== 1) {
        throw new BadRequestException(
          'Status fasilitas berubah oleh proses lain. Silakan muat ulang data.',
        );
      }
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
            fromStatus: current.status,
            toStatus: FacilityStatus.ACTIVE,
            effectiveStatus: 'MAINTENANCE_PERIOD_DERIVED',
          },
        },
      });
      return { ...facility, status: FacilityStatus.ACTIVE };
    });
  }
}
