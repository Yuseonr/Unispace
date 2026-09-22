import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { FacilityStatus, ReservationMode } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ReservationsService } from './reservations.service';
import {
  addOperationalDays,
  formatToJakartaDateString,
} from './utils/reservation-time.util';

// ---------------------------------------------------------------------------
// Stub Data
// ---------------------------------------------------------------------------

const stubExclusiveFacility = {
  id: 'fac-uuid-1',
  assetCode: 'R-101',
  name: 'Ruang Aula 101',
  status: FacilityStatus.ACTIVE,
  facilityGroup: {
    id: 'grp-uuid-1',
    name: 'Gedung Serbaguna',
    reservationMode: ReservationMode.EXCLUSIVE,
  },
  location: { id: 'loc-1', name: 'Gedung Utama', detail: 'Lantai 1' },
};

const stubQuantityGroup = {
  id: 'grp-qty-1',
  name: 'Proyektor Epson EB-X06',
  reservationMode: ReservationMode.QUANTITY,
  facilities: [
    { id: 'unit-1', assetCode: 'PRJ-001', status: FacilityStatus.ACTIVE },
    { id: 'unit-2', assetCode: 'PRJ-002', status: FacilityStatus.ACTIVE },
    { id: 'unit-3', assetCode: 'PRJ-003', status: FacilityStatus.ACTIVE },
  ],
  location: { id: 'loc-1', name: 'Gedung Utama', detail: 'Lantai 1' },
  facilityType: { id: 'type-1', name: 'Alat Elektronik' },
};

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const prismaMock = {
  facility: { findUnique: jest.fn() },
  facilityGroup: { findFirst: jest.fn() },
  reservation: { findMany: jest.fn() },
  maintenancePeriod: { findMany: jest.fn() },
};

describe('ReservationsService - getAvailability', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();
  });

  it('mengembalikan 26 slot 30 menit untuk ruang eksklusif', async () => {
    const today = formatToJakartaDateString(new Date());
    const testDate = addOperationalDays(today, 2);

    prismaMock.facility.findUnique.mockResolvedValue(stubExclusiveFacility);
    prismaMock.reservation.findMany.mockResolvedValue([]);
    prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

    const result = await service.getAvailability({
      facilityId: stubExclusiveFacility.id,
      usageDate: testDate,
    });

    expect(result.slots.length).toBe(26);
    expect(result.slots[0].startTime).toBe('07:00');
    expect(result.slots[0].endTime).toBe('07:30');
    expect(result.slots[25].startTime).toBe('19:30');
    expect(result.slots[25].endTime).toBe('20:00');
    expect(result.slots.every((s: { available: boolean }) => s.available)).toBe(
      true,
    );
  });

  it('menandai slot tidak tersedia pada akhir pekan', async () => {
    prismaMock.facility.findUnique.mockResolvedValue(stubExclusiveFacility);
    prismaMock.reservation.findMany.mockResolvedValue([]);
    prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

    // 2026-09-20 adalah hari Minggu
    const result = await service.getAvailability({
      facilityId: stubExclusiveFacility.id,
      usageDate: '2026-09-20',
    });

    expect(result.isOperationalDay).toBe(false);
    expect(
      result.slots.every((s: { available: boolean }) => !s.available),
    ).toBe(true);
    expect(result.slots[0].reason).toBe('NON_OPERATIONAL_DAY');
  });

  it('menghitung sisa kuantitas unit pada kelompok alat (QUANTITY)', async () => {
    const today = formatToJakartaDateString(new Date());
    const testDate = addOperationalDays(today, 2);

    prismaMock.facilityGroup.findFirst.mockResolvedValue(stubQuantityGroup);
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
        endTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
        requestedQuantity: 2,
      },
    ]);
    prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

    const result = await service.getAvailability({
      facilityGroupId: stubQuantityGroup.id,
      usageDate: testDate,
    });

    expect(result.totalActiveUnits).toBe(3);
    // Slot 08.00 - 08.30 (index 2): 3 - 2 = 1 unit tersedia
    const slot8am = result.slots.find(
      (s: { startTime: string }) => s.startTime === '08:00',
    );
    expect(slot8am.availableUnits).toBe(1);
    expect(slot8am.available).toBe(true);

    // Slot 07.00 - 07.30 (index 0): 3 unit tersedia
    const slot7am = result.slots.find(
      (s: { startTime: string }) => s.startTime === '07:00',
    );
    expect(slot7am.availableUnits).toBe(3);
  });

  it('menolak query jika tidak menyertakan target atau menyertakan keduanya', async () => {
    await expect(
      service.getAvailability({ usageDate: '2026-09-25' }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.getAvailability({
        facilityId: 'fac-1',
        facilityGroupId: 'grp-1',
        usageDate: '2026-09-25',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('melemparkan NotFoundException jika ruang atau kelompok tidak ditemukan', async () => {
    prismaMock.facility.findUnique.mockResolvedValue(null);

    await expect(
      service.getAvailability({
        facilityId: 'non-existent',
        usageDate: '2026-09-25',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
