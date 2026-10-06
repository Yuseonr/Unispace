import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { Prisma as PrismaNamespace } from '../generated/prisma/client';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { PrismaService } from '../database/prisma.service';
import { CreateDirectMaintenanceDto } from './dto/create-direct-maintenance.dto';
import { MaintenanceWorkflowService } from './maintenance-workflow.service';
import { PreviewDirectMaintenanceDto } from './dto/preview-direct-maintenance.dto';

@Injectable()
export class StaffMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: MaintenanceWorkflowService,
    @Optional() private readonly idempotency?: IdempotencyService,
  ) {}

  async previewDirectMaintenance(
    facilityId: string,
    input: PreviewDirectMaintenanceDto,
  ) {
    const { dateStart, dateEnd } = this.workflow.dates(input);
    return this.prisma.$transaction(async (transaction) => {
      const prepared = await this.workflow.prepare(
        transaction,
        facilityId,
        dateStart,
        dateEnd,
      );
      return prepared.impact;
    });
  }

  async createDirectMaintenance(
    staffId: string,
    facilityId: string,
    input: CreateDirectMaintenanceDto,
    idempotencyKey?: string,
  ) {
    if (!input.cancelImpactedReservations) {
      throw new ConflictException({
        code: 'MAINTENANCE_CONFIRMATION_REQUIRED',
        message:
          'Maintenance impact must be confirmed before the period is created.',
      });
    }

    const { dateStart, dateEnd } = this.workflow.dates(input);
    const reason = input.cancellationReason.trim();

    return this.runIdempotently(
      staffId,
      idempotencyKey,
      { facilityId, input },
      () =>
        this.prisma.$transaction(
          async (transaction) => {
            const prepared = await this.workflow.prepare(
              transaction,
              facilityId,
              dateStart,
              dateEnd,
            );
            const now = new Date();
            const impactResult = await this.workflow.applyReservationImpact(
              transaction,
              {
                prepared,
                startAt: dateStart,
                endAt: dateEnd,
                staffId,
                reason,
                now,
                source: { kind: 'DIRECT_MAINTENANCE' },
              },
            );
            const period = await transaction.maintenancePeriod.create({
              data: {
                facilityId,
                startAt: dateStart,
                endAt: dateEnd,
                note: input.note,
                createdById: staffId,
              },
            });

            await transaction.auditLog.create({
              data: {
                actorId: staffId,
                action: 'DIRECT_MAINTENANCE_CREATED',
                entityType: 'MAINTENANCE_PERIOD',
                entityId: period.id,
                metadata: {
                  facilityId,
                  startAt: dateStart.toISOString(),
                  endAt: dateEnd.toISOString(),
                  reason,
                  ...impactResult,
                },
              },
            });

            return {
              id: period.id,
              facilityId: period.facilityId,
              reportId: period.reportId,
              startAt: period.startAt.toISOString(),
              endAt: period.endAt.toISOString(),
              note: period.note,
              ...impactResult,
            };
          },
          {
            isolationLevel:
              PrismaNamespace.TransactionIsolationLevel.Serializable,
          },
        ),
    );
  }

  private runIdempotently<T>(
    staffId: string,
    key: string | undefined,
    payload: unknown,
    operation: () => Promise<T>,
  ) {
    if (!key?.trim() || !this.idempotency) {
      return operation();
    }
    return this.idempotency.execute(staffId, key, payload, operation);
  }
}
