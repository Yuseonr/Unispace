import { jest } from '@jest/globals';
import {
  FacilityStatus,
  ReportCategory,
  ReportStatus,
  ReservationMode,
  ReservationStatus,
} from '../generated/prisma/client';
import type { PrismaService } from '../database/prisma.service';
import { AnalyticsQueryService } from './analytics-query.service';

const area = { id: 'area-1', code: 'FT', name: 'Fakultas Teknik' };
const type = { id: 'type-1', name: 'Ruang Kelas' };

const at = (value: string) => new Date(value);
const usageDate = at('2026-01-12T00:00:00.000Z');

describe('AnalyticsQueryService', () => {
  let service: AnalyticsQueryService;
  let prisma: {
    facility: { findMany: jest.Mock };
    reservation: { findMany: jest.Mock };
    facilityReport: { findMany: jest.Mock };
    facilityArea: { findUnique: jest.Mock };
    facilityType: { findUnique: jest.Mock };
    facilityGroup: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      facility: { findMany: jest.fn() },
      reservation: { findMany: jest.fn() },
      facilityReport: { findMany: jest.fn() },
      facilityArea: { findUnique: jest.fn() },
      facilityType: { findUnique: jest.fn() },
      facilityGroup: { findUnique: jest.fn() },
    };
    service = new AnalyticsQueryService(prisma as unknown as PrismaService);
    prisma.facility.findMany.mockResolvedValue([
      {
        id: 'exclusive-active',
        assetCode: 'RM-101',
        name: 'Ruang 101',
        status: FacilityStatus.ACTIVE,
        createdAt: at('2025-01-01T00:00:00.000Z'),
        statusHistory: [],
        facilityGroup: {
          id: 'exclusive-group',
          name: 'Ruang 101',
          reservationMode: ReservationMode.EXCLUSIVE,
          facilityType: type,
          facilityArea: area,
        },
      },
      {
        id: 'exclusive-currently-nonactive',
        assetCode: 'RM-102',
        name: 'Ruang 102',
        // Status hari ini tidak boleh menghapus kapasitas periode lampau.
        status: FacilityStatus.NONACTIVE,
        createdAt: at('2025-01-01T00:00:00.000Z'),
        statusHistory: [],
        facilityGroup: {
          id: 'exclusive-group-2',
          name: 'Ruang 102',
          reservationMode: ReservationMode.EXCLUSIVE,
          facilityType: type,
          facilityArea: area,
        },
      },
      {
        id: 'quantity-unit',
        assetCode: 'PRJ-001',
        name: null,
        status: FacilityStatus.ACTIVE,
        createdAt: at('2025-01-01T00:00:00.000Z'),
        // Nonaktif 12.00–14.00: empat slot tidak menjadi denominator.
        statusHistory: [
          {
            status: FacilityStatus.NONACTIVE,
            effectiveAt: at('2026-01-12T05:00:00.000Z'),
          },
          {
            status: FacilityStatus.ACTIVE,
            effectiveAt: at('2026-01-12T07:00:00.000Z'),
          },
        ],
        facilityGroup: {
          id: 'quantity-group',
          name: 'Proyektor',
          reservationMode: ReservationMode.QUANTITY,
          facilityType: type,
          facilityArea: area,
        },
      },
    ]);
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: 'reservation-exclusive',
        facilityId: 'exclusive-active',
        facilityGroupId: null,
        requestedQuantity: 1,
        status: ReservationStatus.APPROVED,
        usageDate,
        startTime: at('1970-01-01T07:00:00.000Z'),
        endTime: at('1970-01-01T08:00:00.000Z'),
        createdAt: at('2026-01-10T00:00:00.000Z'),
        decidedAt: at('2026-01-10T02:00:00.000Z'),
        items: [],
      },
      {
        id: 'reservation-quantity',
        facilityId: null,
        facilityGroupId: 'quantity-group',
        requestedQuantity: 2,
        status: ReservationStatus.COMPLETED,
        usageDate,
        startTime: at('1970-01-01T08:00:00.000Z'),
        endTime: at('1970-01-01T09:00:00.000Z'),
        createdAt: at('2026-01-10T00:00:00.000Z'),
        decidedAt: at('2026-01-10T04:00:00.000Z'),
        items: [{ facilityId: 'quantity-unit' }],
      },
    ]);
    prisma.facilityReport.findMany.mockResolvedValue([
      {
        id: 'report-new',
        reportNumber: 'RPT-001',
        category: ReportCategory.PHYSICAL_DAMAGE,
        status: ReportStatus.NEW,
        createdAt: at('2026-01-12T01:00:00.000Z'),
        acceptedAt: null,
        resolvedAt: null,
        decisionReason: null,
        resolutionNote: null,
        reporter: {
          id: 'user-1',
          name: 'User',
          identityNumber: '123',
          email: 'user@example.test',
        },
        acceptedBy: null,
        resolvedBy: null,
        facility: {
          id: 'exclusive-active',
          assetCode: 'RM-101',
          name: 'Ruang 101',
          facilityGroup: {
            id: 'exclusive-group',
            name: 'Ruang 101',
            reservationMode: ReservationMode.EXCLUSIVE,
            facilityType: type,
            facilityArea: area,
          },
        },
      },
      {
        id: 'report-rejected',
        reportNumber: 'RPT-002',
        category: ReportCategory.OTHER,
        status: ReportStatus.REJECTED,
        createdAt: at('2026-01-12T02:00:00.000Z'),
        acceptedAt: null,
        resolvedAt: null,
        decisionReason: 'Duplikat',
        resolutionNote: null,
        reporter: {
          id: 'user-1',
          name: 'User',
          identityNumber: '123',
          email: 'user@example.test',
        },
        acceptedBy: null,
        resolvedBy: null,
        facility: {
          id: 'exclusive-active',
          assetCode: 'RM-101',
          name: 'Ruang 101',
          facilityGroup: {
            id: 'exclusive-group',
            name: 'Ruang 101',
            reservationMode: ReservationMode.EXCLUSIVE,
            facilityType: type,
            facilityArea: area,
          },
        },
      },
    ]);
  });

  const filter = { dateFrom: '2026-01-12', dateTo: '2026-01-12' };

  it('menghitung okupansi dari slot APPROVED/COMPLETED dan status historis', async () => {
    const result = await service.occupancy(filter);

    // Dua ruang aktif historis × 26 slot; status NONACTIVE saat ini tidak dipakai.
    expect(result.availableSlots).toBe(52);
    expect(result.bookedSlots).toBe(2);
    expect(result.percentage).toBe(3.85);
    expect(result.facilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          facilityId: 'exclusive-currently-nonactive',
          availableSlots: 26,
          currentStatus: FacilityStatus.NONACTIVE,
        }),
      ]),
    );
  });

  it('menghitung unit-slot QUANTITY tanpa mengurangi maintenance', async () => {
    const result = await service.equipmentUtilization(filter);

    // Empat slot NONACTIVE dikurangi: 26 - 4 = 22. Maintenance tidak dipakai
    // sebagai pengurang denominator pada rumus ini.
    expect(result.availableUnitSlots).toBe(22);
    expect(result.usedUnitSlots).toBe(4);
    expect(result.percentage).toBe(18.18);
  });

  it('mengecualikan report REJECTED dari frekuensi kerusakan', async () => {
    const result = await service.damageFrequency(filter);

    expect(result.total).toBe(1);
    expect(result.byStatus).toEqual([{ key: ReportStatus.NEW, count: 1 }]);
    expect(result.byCategory).toEqual([
      {
        key: ReportCategory.PHYSICAL_DAMAGE,
        label: 'Kerusakan Fisik',
        count: 1,
      },
    ]);
  });
});
