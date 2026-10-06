import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { FacilityStatus } from '../generated/prisma/client';
import { MaintenanceMode } from './maintenance.constants';
import { MaintenanceWorkflowService } from './maintenance-workflow.service';
import { QuantityReservationReconciliationService } from './quantity-reservation-reconciliation.service';

describe('MaintenanceWorkflowService', () => {
  const reconciliation = {
    findInfeasibleQuantityReservations: jest.fn(),
    lockAvailabilityWindow: jest.fn(),
    rejectExclusiveReservations: jest.fn(),
    rejectInfeasibleQuantityReservations: jest.fn(),
  };
  const workflow = new MaintenanceWorkflowService(
    reconciliation as unknown as QuantityReservationReconciliationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a nonactive facility before locking or calculating maintenance impact', async () => {
    const transaction = {
      facility: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'facility-1',
          status: FacilityStatus.NONACTIVE,
          facilityGroupId: 'group-1',
          facilityGroup: { reservationMode: 'EXCLUSIVE' },
        }),
      },
    };

    await expect(
      workflow.prepare(
        transaction as never,
        'facility-1',
        new Date('2026-10-06T00:00:00.000Z'),
        new Date('2026-10-06T01:00:00.000Z'),
      ),
    ).rejects.toMatchObject({
      response: { code: 'FACILITY_NOT_ACTIVE' },
    });
    expect(reconciliation.lockAvailabilityWindow).not.toHaveBeenCalled();
  });

  it('cancels approved reservations conditionally with cancelledAt and writes an audit record', async () => {
    const now = new Date('2026-10-05T02:00:00.000Z');
    const transaction = {
      reservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    reconciliation.rejectExclusiveReservations.mockResolvedValue({
      rejectedReservationIds: [],
    });

    const result = await workflow.applyReservationImpact(transaction as never, {
      prepared: {
        facilityId: 'facility-1',
        facilityGroupId: 'group-1',
        isQuantity: false,
        impact: {
          facilityId: 'facility-1',
          approvedReservations: [
            {
              id: 'reservation-1',
              usageDate: '2026-10-06T00:00:00.000Z',
              startTime: '1970-01-01T08:00:00.000Z',
              endTime: '1970-01-01T09:00:00.000Z',
            },
          ],
          pendingReservations: [],
        },
      },
      startAt: new Date('2026-10-06T01:00:00.000Z'),
      endAt: new Date('2026-10-06T02:00:00.000Z'),
      staffId: 'staff-1',
      reason: 'Perbaikan AC',
      now,
      source: { kind: 'DIRECT_MAINTENANCE' },
    });

    expect(transaction.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: 'reservation-1', status: 'APPROVED' },
      data: expect.objectContaining({
        status: 'CANCELLED_BY_STAFF',
        cancelledAt: now,
        decidedAt: now,
        decisionReason: 'Perbaikan AC',
      }),
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'RESERVATION_CANCELLED_BY_STAFF',
          entityId: 'reservation-1',
        }),
      }),
    );
    expect(result).toEqual({ approvedCancelled: 1, pendingRejected: 0 });
  });

  it('uses the same complete-day window for DATE_RANGE maintenance', () => {
    const dates = workflow.dates(
      {
        mode: MaintenanceMode.DATE_RANGE,
        startDate: '2026-10-06',
        endDate: '2026-10-07',
      },
      new Date('2026-10-05T00:00:00.000Z'),
    );

    expect(dates.dateStart.toISOString()).toBe('2026-10-06T00:00:00.000Z');
    expect(dates.dateEnd.toISOString()).toBe('2026-10-07T13:00:00.000Z');
  });

  it('rejects a maintenance window that starts in the past', () => {
    expect(() =>
      workflow.dates(
        {
          mode: MaintenanceMode.TIME_RANGE,
          date: '2026-10-05',
          startTime: '07:00',
          endTime: '08:00',
        },
        new Date('2026-10-05T01:00:00.000Z'),
      ),
    ).toThrow(ConflictException);
  });
});
