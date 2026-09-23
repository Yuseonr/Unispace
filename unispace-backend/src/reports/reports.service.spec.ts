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

  it('throws when the report does not exist', async () => {
    prisma.facilityReport.findUnique.mockResolvedValue(null);

    await expect(service.accept('staff-1', 'report-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
