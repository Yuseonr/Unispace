import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { ReportStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { ReportsService } from './reports.service';

const createMockReport = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'report-1',
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

describe('ReportsService lifecycle', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            facilityReport: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            maintenancePeriod: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            auditLog: { create: jest.fn() },
          },
        },
        {
          provide: ObjectStorageService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(ReportsService);
    prisma = module.get(PrismaService) as any;
  });

  it('accepts a new report and records the first processing staff', async () => {
    const report = createMockReport();
    prisma.facilityReport.findUnique.mockResolvedValue(report);
    prisma.facilityReport.update.mockResolvedValue(
      createMockReport({
        status: ReportStatus.IN_PROGRESS,
        acceptedAt: new Date('2026-01-10T09:00:00.000Z'),
        acceptedBy: { id: 'staff-1', name: 'Staff A', identityNumber: 'STAFF-1', email: 'staff@example.test' },
        processedBy: { id: 'staff-1', name: 'Staff A', identityNumber: 'STAFF-1', email: 'staff@example.test' },
      }),
    );

    const result = await service.accept('staff-1', 'report-1');

    expect(prisma.facilityReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
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

  it('rejects a report with a required reason', async () => {
    const report = createMockReport();
    prisma.facilityReport.findUnique.mockResolvedValue(report);
    prisma.facilityReport.update.mockResolvedValue(
      createMockReport({
        status: ReportStatus.REJECTED,
        decisionReason: 'Konten tidak valid',
        acceptedAt: new Date('2026-01-10T09:00:00.000Z'),
        acceptedBy: { id: 'staff-1', name: 'Staff A', identityNumber: 'STAFF-1', email: 'staff@example.test' },
        processedBy: { id: 'staff-1', name: 'Staff A', identityNumber: 'STAFF-1', email: 'staff@example.test' },
      }),
    );

    const result = await service.reject('staff-1', 'report-1', 'Konten tidak valid');

    expect(prisma.facilityReport.update).toHaveBeenCalledWith(
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

  it('resolves a report with a mandatory resolution note', async () => {
    const report = createMockReport({ status: ReportStatus.IN_PROGRESS });
    prisma.facilityReport.findUnique.mockResolvedValue(report);
    prisma.facilityReport.update.mockResolvedValue(
      createMockReport({
        status: ReportStatus.RESOLVED,
        resolutionNote: 'AC sudah diperbaiki',
        resolvedAt: new Date('2026-01-10T09:30:00.000Z'),
        resolvedBy: { id: 'staff-1', name: 'Staff A', identityNumber: 'STAFF-1', email: 'staff@example.test' },
        processedBy: { id: 'staff-1', name: 'Staff A', identityNumber: 'STAFF-1', email: 'staff@example.test' },
      }),
    );

    const result = await service.resolve('staff-1', 'report-1', 'AC sudah diperbaiki');

    expect(prisma.facilityReport.update).toHaveBeenCalledWith(
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
    await expect(service.resolve('staff-1', 'report-1', 'note')).rejects.toBeInstanceOf(
      ConflictException,
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

    const result = await service.createMaintenancePeriod('staff-1', 'report-1', {
      mode: 'DATE_RANGE',
      startDate: '2026-01-12',
      endDate: '2026-01-12',
      cancelImpactedReservations: true,
      cancellationReason: 'Pemeliharaan AC',
      note: 'Pemeliharaan AC',
    });

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

  it('rejects maintenance creation when the report is not in progress', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(
      createMockReport({ status: ReportStatus.NEW }),
    );

    await expect(
      service.createMaintenancePeriod('staff-1', 'report-1', {
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
      startAt: new Date('2026-01-12T07:00:00.000Z'),
      endAt: new Date('2026-01-12T20:00:00.000Z'),
      note: 'Pemeliharaan AC',
    });
    prisma.maintenancePeriod.update.mockResolvedValue({
      id: 'period-1',
      facilityId: 'facility-1',
      reportId: 'report-1',
      startAt: new Date('2026-01-12T07:00:00.000Z'),
      endAt: new Date('2026-01-12T09:00:00.000Z'),
      note: 'Pemeliharaan AC',
    });

    const result = await service.endMaintenancePeriod('staff-1', 'period-1', new Date('2026-01-12T09:00:00.000Z'));

    expect(prisma.maintenancePeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'period-1' },
        data: expect.objectContaining({
          endAt: expect.any(Date),
        }),
      }),
    );
    expect(result.endAt).toBe(new Date('2026-01-12T09:00:00.000Z').toISOString());
  });

  it('throws when the maintenance period does not exist', async () => {
    prisma.maintenancePeriod.findUnique.mockResolvedValue(null);

    await expect(
      service.endMaintenancePeriod('staff-1', 'missing-period', new Date('2026-01-12T09:00:00.000Z')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when the report does not exist', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(null);

    await expect(service.accept('staff-1', 'report-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
