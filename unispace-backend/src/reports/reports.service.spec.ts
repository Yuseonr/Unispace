import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { ReportCategory, ReportStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { ReportsService } from './reports.service';
import { CreateMaintenancePeriodDto } from './dto/create-maintenance-period.dto';
import { PreviewMaintenanceImpactDto } from './dto/preview-maintenance-impact.dto';
import { MaintenanceMode } from './reports.constants';
import { QuantityReservationReconciliationService } from '../facilities/quantity-reservation-reconciliation.service';

const createMockReport = (overrides: Record<string, unknown> = {}) => ({
  id: 'report-1',
  reportNumber: 'RPT-20260110-TEST-0001',
  facilityId: 'facility-1',
  category: 'PHYSICAL_DAMAGE',
  description: 'Kursi rusak',
  status: ReportStatus.NEW,
  decisionReason: null,
  resolutionNote: null,
  acceptedAt: null,
  resolvedAt: null,
  createdAt: new Date('2026-01-10T08:00:00.000Z'),
  updatedAt: new Date('2026-01-10T08:00:00.000Z'),
  reporter: {
    id: 'user-1',
    name: 'User A',
    identityNumber: '001',
    email: 'user@example.test',
  },
  acceptedBy: null,
  resolvedBy: null,
  facility: {
    id: 'facility-1',
    assetCode: 'R-101',
    name: 'Ruang 101',
    status: 'ACTIVE',
    facilityGroupId: 'group-1',
    facilityGroup: {
      name: 'Ruang Kelas',
      reservationMode: 'EXCLUSIVE',
    },
  },
  attachments: [],
  maintenancePeriods: [],
  ...overrides,
});

const mockDelegates = () => ({
  facilityReport: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  reportAttachment: { createMany: jest.fn() },
  maintenancePeriod: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  reservation: { findMany: jest.fn(), updateMany: jest.fn() },
  facility: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  facilityStatusHistory: { create: jest.fn() },
  auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  $executeRaw: jest.fn(),
});

type MockPrisma = ReturnType<typeof mockDelegates> & {
  $transaction: jest.Mock;
};

const storage = {
  uploadReportPhoto: jest.fn(),
  remove: jest.fn(),
};

describe('ReportsService lifecycle', () => {
  let service: ReportsService;
  let prisma: MockPrisma;

  const mockFacility = {
    id: 'facility-1',
    facilityGroupId: 'group-1',
    status: 'ACTIVE',
    facilityGroup: { reservationMode: 'EXCLUSIVE', facilities: [] },
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-10T08:00:00.000Z'));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        QuantityReservationReconciliationService,
        {
          provide: PrismaService,
          useValue: { ...mockDelegates(), $transaction: jest.fn() },
        },
        {
          provide: ObjectStorageService,
          useValue: storage,
        },
      ],
    }).compile();

    service = module.get(ReportsService);
    prisma = module.get(PrismaService) as unknown as MockPrisma;
    jest.clearAllMocks();
    prisma.maintenancePeriod.findFirst.mockResolvedValue(null);
    prisma.facility.findUnique.mockResolvedValue({
      id: 'facility-1',
      status: 'ACTIVE',
      facilityGroup: { reservationMode: 'EXCLUSIVE', facilities: [] },
    });
    prisma.reservation.findMany.mockResolvedValue([]);
    prisma.maintenancePeriod.findMany.mockResolvedValue([]);
    prisma.facility.findMany.mockResolvedValue([]);
    prisma.facilityReport.updateMany.mockResolvedValue({ count: 1 });
    prisma.$executeRaw.mockResolvedValue(1);
    storage.uploadReportPhoto.mockReset();
    storage.remove.mockReset();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: MockPrisma) => unknown) => callback(prisma),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('accepts a new report and records the first processing staff', async () => {
    const report = createMockReport();
    prisma.facilityReport.findUnique
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce(
        createMockReport({
          status: ReportStatus.IN_PROGRESS,
          acceptedAt: new Date('2026-01-10T09:00:00.000Z'),
          acceptedBy: {
            id: 'staff-1',
            name: 'Staff A',
            identityNumber: 'STAFF-1',
            email: 'staff@example.test',
          },
          processedBy: {
            id: 'staff-1',
            name: 'Staff A',
            identityNumber: 'STAFF-1',
            email: 'staff@example.test',
          },
        }),
      );

    const result = await service.accept('staff-1', 'report-1');

    expect(prisma.facilityReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1', status: ReportStatus.NEW },
        data: expect.objectContaining({
          status: ReportStatus.IN_PROGRESS,
          acceptedById: 'staff-1',
          acceptedAt: expect.any(Date),
          processedById: 'staff-1',
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REPORT_ACCEPTED',
          entityId: 'report-1',
        }),
      }),
    );
    expect(result.status).toBe(ReportStatus.IN_PROGRESS);
  });

  it('does not create a second acceptance audit for an already in-progress report', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.IN_PROGRESS }),
    );

    const result = await service.accept('staff-2', 'report-1');

    expect(result.status).toBe(ReportStatus.IN_PROGRESS);
    expect(prisma.facilityReport.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns a paginated immutable audit timeline for a report', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue({
      id: 'report-1',
      facilityId: 'facility-1',
      maintenancePeriods: [{ id: 'period-1' }],
    });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'REPORT_ACCEPTED',
        entityType: 'FACILITY_REPORT',
        entityId: 'report-1',
        metadata: { fromStatus: 'NEW', toStatus: 'IN_PROGRESS' },
        createdAt: new Date('2026-01-10T09:00:00.000Z'),
        actor: { id: 'staff-1', name: 'Staff A', role: 'STAFF' },
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.listAudit('report-1', {
      page: 1,
      limit: 50,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].metadata).toEqual({
      fromStatus: 'NEW',
      toStatus: 'IN_PROGRESS',
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { entityType: 'FACILITY_REPORT', entityId: 'report-1' },
            {
              entityType: 'MAINTENANCE_PERIOD',
              entityId: { in: ['period-1'] },
            },
            { entityType: 'FACILITY', entityId: 'facility-1' },
          ]),
        }),
      }),
    );
  });

  it('rejects a report with a required reason', async () => {
    const report = createMockReport();
    prisma.facilityReport.findUnique
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce(
        createMockReport({
          status: ReportStatus.REJECTED,
          decisionReason: 'Konten tidak valid',
          acceptedAt: new Date('2026-01-10T09:00:00.000Z'),
          acceptedBy: {
            id: 'staff-1',
            name: 'Staff A',
            identityNumber: 'STAFF-1',
            email: 'staff@example.test',
          },
          processedBy: {
            id: 'staff-1',
            name: 'Staff A',
            identityNumber: 'STAFF-1',
            email: 'staff@example.test',
          },
        }),
      );

    const result = await service.reject(
      'staff-1',
      'report-1',
      'Konten tidak valid',
    );

    expect(prisma.facilityReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReportStatus.REJECTED,
          decisionReason: 'Konten tidak valid',
          processedById: 'staff-1',
        }),
      }),
    );
    expect(result.status).toBe(ReportStatus.REJECTED);
  });

  it('does not reject a report while its maintenance period is active or scheduled', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.IN_PROGRESS }),
    );
    prisma.maintenancePeriod.findFirst.mockResolvedValue({ id: 'period-1' });

    await expect(
      service.reject('staff-1', 'report-1', 'Bukan kerusakan operasional'),
    ).rejects.toMatchObject({
      response: { code: 'REPORT_MAINTENANCE_STILL_ACTIVE_OR_SCHEDULED' },
    });
    expect(prisma.facilityReport.updateMany).not.toHaveBeenCalled();
  });

  it('resolves a report with a mandatory resolution note', async () => {
    const report = createMockReport({ status: ReportStatus.IN_PROGRESS });
    prisma.facilityReport.findUnique
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce(
        createMockReport({
          status: ReportStatus.RESOLVED,
          resolutionNote: 'AC sudah diperbaiki',
          resolvedAt: new Date('2026-01-10T09:30:00.000Z'),
          resolvedBy: {
            id: 'staff-1',
            name: 'Staff A',
            identityNumber: 'STAFF-1',
            email: 'staff@example.test',
          },
          processedBy: {
            id: 'staff-1',
            name: 'Staff A',
            identityNumber: 'STAFF-1',
            email: 'staff@example.test',
          },
        }),
      );

    const result = await service.resolve(
      'staff-1',
      'report-1',
      'AC sudah diperbaiki',
    );

    expect(prisma.facilityReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReportStatus.RESOLVED,
          resolutionNote: 'AC sudah diperbaiki',
          resolvedById: 'staff-1',
          resolvedAt: expect.any(Date),
          processedById: 'staff-1',
        }),
      }),
    );
    expect(result.status).toBe(ReportStatus.RESOLVED);
  });

  it('rejects invalid lifecycle transitions', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.RESOLVED }),
    );

    await expect(service.accept('staff-1', 'report-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.resolve('staff-1', 'report-1', 'note'),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.NEW }),
    );
    await expect(
      service.resolve('staff-1', 'report-1', 'note'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks resolution only while maintenance belongs to the same report', async () => {
    const report = createMockReport({ status: ReportStatus.IN_PROGRESS });
    prisma.facilityReport.findUnique.mockResolvedValue(report);

    prisma.maintenancePeriod.findFirst.mockResolvedValueOnce({
      id: 'scheduled-by-other-report',
    });
    await expect(
      service.resolve('staff-1', 'report-1', 'AC sudah diperbaiki'),
    ).rejects.toMatchObject({
      response: { code: 'REPORT_MAINTENANCE_STILL_ACTIVE_OR_SCHEDULED' },
    });

    expect(prisma.maintenancePeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reportId: 'report-1',
          endAt: { gt: expect.any(Date) },
        }),
      }),
    );
  });

  it('creates a maintenance period from an in-progress report', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({
        id: 'report-1',
        status: ReportStatus.IN_PROGRESS,
        facility: {
          id: 'facility-1',
          assetCode: 'R-101',
          name: 'Ruang 101',
          status: 'ACTIVE',
          facilityGroupId: 'group-1',
          facilityGroup: { name: 'Ruang Kelas', reservationMode: 'EXCLUSIVE' },
        },
      }),
    );
    prisma.maintenancePeriod.create.mockResolvedValue({
      id: 'period-1',
      facilityId: 'facility-1',
      reportId: 'report-1',
      startAt: new Date('2026-01-12T07:00:00.000Z'),
      endAt: new Date('2026-01-12T20:00:00.000Z'),
      note: 'Pemeliharaan AC',
    });

    const result = await service.confirmMaintenancePeriod(
      'staff-1',
      'report-1',
      {
        mode: 'DATE_RANGE',
        startDate: '2026-01-12',
        endDate: '2026-01-12',
        cancelImpactedReservations: true,
        cancellationReason: 'Pemeliharaan AC',
        note: 'Pemeliharaan AC',
      },
    );

    expect(prisma.maintenancePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportId: 'report-1',
          facilityId: 'facility-1',
          note: 'Pemeliharaan AC',
        }),
      }),
    );
    expect(result.note).toBe('Pemeliharaan AC');
  });

  it('rejects a maintenance period that is entirely in the past', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.IN_PROGRESS }),
    );

    await expect(
      service.confirmMaintenancePeriod('staff-1', 'report-1', {
        mode: 'DATE_RANGE',
        startDate: '2026-01-09',
        endDate: '2026-01-09',
        cancelImpactedReservations: true,
        cancellationReason: 'Pemeliharaan AC',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects maintenance creation when the report is not in progress', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.NEW }),
    );

    await expect(
      service.confirmMaintenancePeriod('staff-1', 'report-1', {
        mode: 'DATE_RANGE',
        startDate: '2026-01-12',
        endDate: '2026-01-12',
        cancelImpactedReservations: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('closes a maintenance period early when a staff overrides the end time', async () => {
    prisma.maintenancePeriod.findUnique.mockResolvedValue({
      id: 'period-1',
      facilityId: 'facility-1',
      reportId: 'report-1',
      startAt: new Date('2026-01-09T07:00:00.000Z'),
      endAt: new Date('2026-01-12T20:00:00.000Z'),
      note: 'Pemeliharaan AC',
      facility: {
        facilityGroupId: 'group-1',
        facilityGroup: { reservationMode: 'EXCLUSIVE' },
      },
    });
    prisma.maintenancePeriod.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.endMaintenancePeriod(
      'staff-1',
      'period-1',
      new Date('2026-01-10T08:00:00.000Z'),
    );

    expect(prisma.maintenancePeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'period-1' }),
        data: expect.objectContaining({
          endAt: expect.any(Date),
        }),
      }),
    );
    expect(result.endAt).toBe(
      new Date('2026-01-10T08:00:00.000Z').toISOString(),
    );
  });

  it('rejects an early-end override for a maintenance period that has already ended', async () => {
    prisma.maintenancePeriod.findUnique.mockResolvedValue({
      id: 'period-1',
      facilityId: 'facility-1',
      reportId: 'report-1',
      startAt: new Date('2026-01-09T07:00:00.000Z'),
      endAt: new Date('2026-01-09T20:00:00.000Z'),
      note: 'Pemeliharaan AC',
      facility: {
        facilityGroupId: 'group-1',
        facilityGroup: { reservationMode: 'EXCLUSIVE' },
      },
    });

    await expect(
      service.endMaintenancePeriod(
        'staff-1',
        'period-1',
        new Date('2026-01-10T08:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.maintenancePeriod.updateMany).not.toHaveBeenCalled();
  });

  it('throws when the maintenance period does not exist', async () => {
    prisma.maintenancePeriod.findUnique.mockResolvedValue(null);

    await expect(
      service.endMaintenancePeriod(
        'staff-1',
        'missing-period',
        new Date('2026-01-12T09:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('aligns the maintenance window to Jakarta time instead of UTC', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.IN_PROGRESS }),
    );
    prisma.facility.findUnique.mockResolvedValue(mockFacility);
    prisma.reservation.findMany.mockImplementation(
      async ({ where }: { where: { status?: string } }) =>
        where.status === 'APPROVED'
          ? [
              {
                id: 'res-early',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T07:30:00.000Z'),
                endTime: new Date('2026-01-01T08:00:00.000Z'),
                requestedQuantity: 1,
                status: 'APPROVED',
              },
            ]
          : [
              {
                id: 'res-midday',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T12:00:00.000Z'),
                endTime: new Date('2026-01-01T13:00:00.000Z'),
                requestedQuantity: 1,
                status: 'PENDING',
              },
            ],
    );

    const result = await service.previewReportMaintenanceImpact('report-1', {
      mode: MaintenanceMode.TIME_RANGE,
      date: '2026-01-12',
      startTime: '07:00',
      endTime: '08:00',
    });

    expect(result.approvedReservations.map((r) => r.id)).toContain('res-early');
    expect(result.approvedReservations).toHaveLength(1);
    expect(result.pendingReservations.map((r) => r.id)).not.toContain(
      'res-midday',
    );
  });

  it('returns impacted reservations for a maintenance window', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.IN_PROGRESS }),
    );
    prisma.facility.findUnique.mockResolvedValue(mockFacility);
    prisma.reservation.findMany.mockImplementation(
      async ({ where }: { where: { status?: string } }) =>
        where.status === 'APPROVED'
          ? [
              {
                id: 'res-1',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T07:30:00.000Z'),
                endTime: new Date('2026-01-01T09:00:00.000Z'),
                requestedQuantity: 2,
                status: 'APPROVED',
              },
            ]
          : [
              {
                id: 'res-2',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T08:00:00.000Z'),
                endTime: new Date('2026-01-01T09:30:00.000Z'),
                requestedQuantity: 1,
                status: 'PENDING',
              },
            ],
    );

    const result = await service.previewReportMaintenanceImpact('report-1', {
      mode: MaintenanceMode.TIME_RANGE,
      date: '2026-01-12',
      startTime: '07:00',
      endTime: '20:00',
    });

    expect(result.approvedReservations).toHaveLength(1);
    expect(result.pendingReservations).toHaveLength(1);
    expect(result.approvedReservations[0].id).toBe('res-1');
  });

  it('recalculates impact during confirmation instead of trusting a stale preview', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.IN_PROGRESS }),
    );
    prisma.facility.findUnique.mockResolvedValue(mockFacility);
    let approvedExists = false;
    prisma.reservation.findMany.mockImplementation(
      async ({ where }: { where: { status?: string } }) =>
        where.status === 'APPROVED' && approvedExists
          ? [
              {
                id: 'res-late',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T08:00:00.000Z'),
                endTime: new Date('2026-01-01T09:00:00.000Z'),
                requestedQuantity: 1,
                status: 'APPROVED',
              },
            ]
          : [],
    );

    const window = {
      mode: MaintenanceMode.DATE_RANGE,
      startDate: '2026-01-12',
      endDate: '2026-01-12',
    } as const;
    const preview = await service.previewReportMaintenanceImpact(
      'report-1',
      window,
    );
    expect(preview.approvedReservations).toHaveLength(0);

    approvedExists = true;
    prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.maintenancePeriod.create.mockResolvedValue({
      id: 'period-stale-preview',
      reportId: 'report-1',
      facilityId: 'facility-1',
      startAt: new Date('2026-01-12T00:00:00.000Z'),
      endAt: new Date('2026-01-12T13:00:00.000Z'),
      note: 'Pemeliharaan AC',
    });

    const result = await service.confirmMaintenancePeriod(
      'staff-1',
      'report-1',
      {
        ...window,
        cancelImpactedReservations: true,
        cancellationReason: 'Pemeliharaan AC',
      },
    );

    expect(result.approvedCancelled).toBe(1);
    expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-late', status: 'APPROVED' },
      }),
    );
  });

  it('cancels approved and rejects pending reservations for an EXCLUSIVE facility on confirmation', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.IN_PROGRESS }),
    );
    prisma.facility.findUnique.mockResolvedValue(mockFacility);
    prisma.reservation.findMany.mockImplementation(
      async ({ where }: { where: { status?: string } }) =>
        where.status === 'APPROVED'
          ? [
              {
                id: 'res-1',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T07:30:00.000Z'),
                endTime: new Date('2026-01-01T09:00:00.000Z'),
                requestedQuantity: 2,
                status: 'APPROVED',
                facilityId: 'facility-1',
                facilityGroupId: 'group-1',
              },
            ]
          : [
              {
                id: 'res-2',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T08:00:00.000Z'),
                endTime: new Date('2026-01-01T09:30:00.000Z'),
                requestedQuantity: 1,
                status: 'PENDING',
                facilityId: 'facility-1',
                facilityGroupId: 'group-1',
              },
            ],
    );
    prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.maintenancePeriod.create.mockResolvedValue({
      id: 'period-1',
      reportId: 'report-1',
      facilityId: 'facility-1',
      startAt: new Date('2026-01-12T00:00:00.000Z'),
      endAt: new Date('2026-01-12T13:00:00.000Z'),
      note: 'Pemeliharaan AC',
    });

    const result = await service.confirmMaintenancePeriod(
      'staff-1',
      'report-1',
      {
        mode: 'DATE_RANGE',
        startDate: '2026-01-12',
        endDate: '2026-01-12',
        cancelImpactedReservations: true,
        cancellationReason: 'Pemeliharaan AC',
      },
    );

    expect(prisma.reservation.updateMany).toHaveBeenCalledTimes(2);
    expect(result.approvedCancelled).toBe(1);
    expect(result.pendingRejected).toBe(1);
  });

  it('creates maintenance atomically and rejects only insufficient QUANTITY pending reservations', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({
        status: ReportStatus.IN_PROGRESS,
        facility: {
          ...createMockReport().facility,
          facilityGroup: {
            name: 'Alat',
            reservationMode: 'QUANTITY',
          },
        },
      }),
    );
    prisma.facility.findUnique.mockResolvedValue({
      id: 'facility-1',
      facilityGroupId: 'group-1',
      status: 'ACTIVE',
      facilityGroup: {
        reservationMode: 'QUANTITY',
        facilities: [
          { id: 'facility-1' },
          { id: 'facility-2' },
          { id: 'facility-3' },
          { id: 'facility-4' },
        ],
      },
    });
    prisma.facility.findMany.mockResolvedValue([
      { id: 'facility-1' },
      { id: 'facility-2' },
      { id: 'facility-3' },
      { id: 'facility-4' },
    ]);
    let approvedIsCancelled = false;
    prisma.reservation.findMany.mockImplementation(
      async ({ where }: { where: { status?: string } }) => {
        return where.status === 'APPROVED'
          ? approvedIsCancelled
            ? []
            : [
                {
                  id: 'approved-1',
                  usageDate: new Date('2026-01-12T00:00:00.000Z'),
                  startTime: new Date('2026-01-01T08:00:00.000Z'),
                  endTime: new Date('2026-01-01T09:00:00.000Z'),
                  requestedQuantity: 2,
                  status: 'APPROVED',
                  facilityId: null,
                  facilityGroupId: 'group-1',
                },
              ]
          : [
              {
                id: 'pending-1',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T08:00:00.000Z'),
                endTime: new Date('2026-01-01T09:00:00.000Z'),
                requestedQuantity: 1,
                status: 'PENDING',
                facilityId: null,
                facilityGroupId: 'group-1',
              },
            ];
      },
    );
    prisma.maintenancePeriod.create.mockResolvedValue({
      id: 'period-2',
      reportId: 'report-1',
      facilityId: 'facility-1',
      startAt: new Date('2026-01-12T01:00:00.000Z'),
      endAt: new Date('2026-01-12T13:00:00.000Z'),
      note: 'Pemeliharaan AC',
    });
    prisma.reservation.updateMany.mockImplementation(
      async ({ where }: { where: { id?: string } }) => {
        if (where.id === 'approved-1') {
          approvedIsCancelled = true;
        }
        return { count: 1 };
      },
    );

    const result = await service.confirmMaintenancePeriod(
      'staff-1',
      'report-1',
      {
        mode: 'DATE_RANGE',
        startDate: '2026-01-12',
        endDate: '2026-01-12',
        cancelImpactedReservations: true,
        cancellationReason: 'Pemeliharaan AC',
      },
    );

    expect(prisma.maintenancePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportId: 'report-1',
          facilityId: 'facility-1',
        }),
      }),
    );
    expect(prisma.reservation.updateMany).toHaveBeenCalledTimes(1);
    expect(result.pendingRejected).toBe(0);
  });

  it('throws when the report does not exist', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(null);

    await expect(service.accept('staff-1', 'report-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('generates a unique report number when a report is created', async () => {
    const report = createMockReport({
      reportNumber: 'RPT-20260923T153045-ABC123',
    });
    prisma.facility.findUnique.mockResolvedValue({
      id: 'facility-1',
      status: 'ACTIVE',
    });
    prisma.facilityReport.create.mockResolvedValue(report);
    prisma.facilityReport.findFirst.mockResolvedValue(report);
    prisma.reportAttachment.createMany.mockResolvedValue({ count: 1 });
    storage.uploadReportPhoto.mockResolvedValue({
      storageProvider: 'MINIO',
      objectKey: 'reports/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',
      objectUrl:
        's3://unispace-dev/reports/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',
      originalFilename: 'kursi.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 8,
    });

    const result = await service.create(
      'user-1',
      {
        facilityId: 'facility-1',
        category: ReportCategory.PHYSICAL_DAMAGE,
        description: 'Kursi rusak',
      },
      [
        {
          buffer: Buffer.from([0xff, 0xd8, 0xff]),
          size: 3,
          mimetype: 'image/jpeg',
          originalname: 'kursi.jpg',
        } as Express.Multer.File,
      ],
    );

    expect(prisma.facilityReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportNumber: expect.stringMatching(/^RPT-\d{14}-[0-9A-F]{6}$/),
        }),
      }),
    );
    expect(result.reportNumber).toBe('RPT-20260923T153045-ABC123');
  });

  it('removes files already uploaded when a later report photo upload fails', async () => {
    const attachment = {
      storageProvider: 'MINIO',
      objectKey: 'reports/uploaded-first.jpg',
      objectUrl: 'https://storage.example.test/reports/uploaded-first.jpg',
      originalFilename: 'uploaded-first.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
    };
    storage.uploadReportPhoto
      .mockResolvedValueOnce(attachment)
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      service.create(
        'user-1',
        {
          facilityId: 'facility-1',
          category: ReportCategory.PHYSICAL_DAMAGE,
          description: 'Kursi rusak',
        },
        [{} as Express.Multer.File, {} as Express.Multer.File],
      ),
    ).rejects.toThrow('storage unavailable');

    expect(storage.remove).toHaveBeenCalledWith(attachment.objectKey);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records the maintenance impact confirmation on the audit timeline', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.IN_PROGRESS }),
    );
    prisma.facility.findUnique.mockResolvedValue(mockFacility);
    prisma.reservation.findMany.mockImplementation(
      async ({ where }: { where: { status?: string } }) =>
        where.status === 'APPROVED'
          ? [
              {
                id: 'res-1',
                usageDate: new Date('2026-01-12T00:00:00.000Z'),
                startTime: new Date('2026-01-01T07:30:00.000Z'),
                endTime: new Date('2026-01-01T09:00:00.000Z'),
                requestedQuantity: 2,
                status: 'APPROVED',
                facilityId: 'facility-1',
                facilityGroupId: 'group-1',
              },
            ]
          : [],
    );
    prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
    prisma.maintenancePeriod.create.mockResolvedValue({
      id: 'period-1',
      reportId: 'report-1',
      facilityId: 'facility-1',
      startAt: new Date('2026-01-12T00:00:00.000Z'),
      endAt: new Date('2026-01-12T13:00:00.000Z'),
      note: 'Pemeliharaan AC',
    });

    await service.confirmMaintenancePeriod('staff-1', 'report-1', {
      mode: 'DATE_RANGE',
      startDate: '2026-01-12',
      endDate: '2026-01-12',
      cancelImpactedReservations: true,
      cancellationReason: 'Pemeliharaan AC',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MAINTENANCE_IMPACT_CONFIRMED',
          entityType: 'FACILITY_REPORT',
          entityId: 'report-1',
          metadata: expect.objectContaining({
            approvedImpactCount: 1,
            pendingImpactCount: 0,
          }),
        }),
      }),
    );
  });
});

describe('CreateMaintenancePeriodDto validation', () => {
  const base = {
    cancelImpactedReservations: true,
    cancellationReason: 'Pemeliharaan AC',
  };

  it('accepts a valid DATE_RANGE without specific times', async () => {
    const dto = new CreateMaintenancePeriodDto();
    Object.assign(dto, {
      mode: MaintenanceMode.DATE_RANGE,
      startDate: '2026-01-12',
      endDate: '2026-01-14',
      ...base,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects DATE_RANGE with a specific time mixed in', async () => {
    const dto = new CreateMaintenancePeriodDto();
    Object.assign(dto, {
      mode: MaintenanceMode.DATE_RANGE,
      startDate: '2026-01-12',
      endDate: '2026-01-14',
      startTime: '08:00',
      ...base,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'mode')).toBe(true);
  });

  it('rejects DATE_RANGE without an end date', async () => {
    const dto = new CreateMaintenancePeriodDto();
    Object.assign(dto, {
      mode: MaintenanceMode.DATE_RANGE,
      startDate: '2026-01-12',
      ...base,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'endDate')).toBe(true);
  });

  it('accepts a valid TIME_RANGE on 30-minute slot boundaries', async () => {
    const dto = new CreateMaintenancePeriodDto();
    Object.assign(dto, {
      mode: MaintenanceMode.TIME_RANGE,
      date: '2026-01-12',
      startTime: '07:30',
      endTime: '10:00',
      ...base,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects TIME_RANGE outside operating hours or off-boundary slots', async () => {
    const cases = [
      { date: '2026-01-12', startTime: '06:30', endTime: '08:00' },
      { date: '2026-01-12', startTime: '07:15', endTime: '08:00' },
      { date: '2026-01-12', startTime: '19:30', endTime: '20:30' },
    ];
    for (const input of cases) {
      const dto = new CreateMaintenancePeriodDto();
      Object.assign(dto, {
        mode: MaintenanceMode.TIME_RANGE,
        ...input,
        ...base,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects TIME_RANGE where start is not before end', async () => {
    const dto = new CreateMaintenancePeriodDto();
    Object.assign(dto, {
      mode: MaintenanceMode.TIME_RANGE,
      date: '2026-01-12',
      startTime: '10:00',
      endTime: '08:00',
      ...base,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('PreviewMaintenanceImpactDto validation', () => {
  it('uses the same maintenance window contract as confirmation', async () => {
    const dto = new PreviewMaintenanceImpactDto();
    Object.assign(dto, {
      mode: MaintenanceMode.TIME_RANGE,
      date: '2026-01-12',
      startTime: '08:00',
      endTime: '10:00',
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
