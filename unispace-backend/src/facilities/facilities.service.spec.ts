import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { ReservationMode, FacilityStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FacilitiesService } from './facilities.service';
import { QueryFacilitiesDto } from './dto/query-facilities.dto';

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const stubType = { id: 'type-1', name: 'Ruang Kelas' };
const stubLocation = { id: 'loc-1', name: 'Gedung A', detail: 'Lantai 1' };

const stubExclusiveGroup = {
  id: 'grp-ex-1',
  name: 'Ruang 101',
  reservationMode: ReservationMode.EXCLUSIVE,
  facilityType: stubType,
  location: stubLocation,
};

const stubExclusiveFacility = {
  id: 'fac-1',
  assetCode: 'R-101',
  name: 'Ruang Kelas 101',
  capacity: 40,
  description: 'Ruang kelas standar',
  primaryImageUrl: 'https://example.com/r101.jpg',
  status: FacilityStatus.ACTIVE,
  facilityGroup: stubExclusiveGroup,
};

const stubQuantityGroup = {
  id: 'grp-qty-1',
  name: 'Proyektor Epson EB-X06',
  reservationMode: ReservationMode.QUANTITY,
  capacity: 1,
  description: 'Proyektor portabel',
  primaryImageUrl: 'https://example.com/prj.jpg',
  facilityType: stubType,
  location: stubLocation,
  _count: { facilities: 5 },
};

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------

const prismaMock = {
  facilityType: { findMany: jest.fn(), findUnique: jest.fn() },
  location: { findMany: jest.fn(), findUnique: jest.fn() },
  facility: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  facilityGroup: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  reservation: { findMany: jest.fn() },
  maintenancePeriod: { findMany: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FacilitiesService', () => {
  let service: FacilitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacilitiesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<FacilitiesService>(FacilitiesService);
    jest.clearAllMocks();
  });

  // ── listTypes ──────────────────────────────────────────────────────────────

  describe('listTypes', () => {
    it('mengembalikan daftar tipe fasilitas terurut A–Z', async () => {
      prismaMock.facilityType.findMany.mockResolvedValue([stubType]);
      const result = await service.listTypes();
      expect(result).toEqual([stubType]);
      expect(prismaMock.facilityType.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  // ── listLocations ─────────────────────────────────────────────────────────

  describe('listLocations', () => {
    it('mengembalikan daftar lokasi terurut A–Z', async () => {
      prismaMock.location.findMany.mockResolvedValue([stubLocation]);
      const result = await service.listLocations();
      expect(result).toEqual([stubLocation]);
      expect(prismaMock.location.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  // ── list (katalog) ────────────────────────────────────────────────────────

  describe('list', () => {
    it('mengembalikan kartu EXCLUSIVE dan QUANTITY dengan paginasi default', async () => {
      prismaMock.facility.findMany.mockResolvedValue([stubExclusiveFacility]);
      prismaMock.facility.count.mockResolvedValue(1);
      prismaMock.facilityGroup.findMany.mockResolvedValue([stubQuantityGroup]);
      prismaMock.facilityGroup.count.mockResolvedValue(1);

      const query = new QueryFacilitiesDto();
      const result = await service.list(query);

      expect(result.exclusive.data).toHaveLength(1);
      expect(result.exclusive.data[0].kind).toBe('EXCLUSIVE');
      expect(result.exclusive.data[0].assetCode).toBe('R-101');
      expect(result.quantity.data).toHaveLength(1);
      expect(result.quantity.data[0].kind).toBe('QUANTITY');
      expect(result.quantity.data[0].activeUnits).toBe(5);
    });

    it('meneruskan filter facilityTypeId ke Prisma', async () => {
      prismaMock.facility.findMany.mockResolvedValue([]);
      prismaMock.facility.count.mockResolvedValue(0);
      prismaMock.facilityGroup.findMany.mockResolvedValue([]);
      prismaMock.facilityGroup.count.mockResolvedValue(0);

      const query = Object.assign(new QueryFacilitiesDto(), {
        facilityTypeId: 'type-1',
      });
      await service.list(query);

      // filter harus ada di where yang dikirim ke Prisma
      const exclusiveWhere = prismaMock.facility.findMany.mock.calls[0][0].where as Record<string, unknown>;
      const groupWhere = exclusiveWhere['facilityGroup'] as Record<string, unknown>;
      expect(groupWhere['facilityTypeId']).toBe('type-1');
    });

    it('meneruskan filter minCapacity ke Prisma', async () => {
      prismaMock.facility.findMany.mockResolvedValue([]);
      prismaMock.facility.count.mockResolvedValue(0);
      prismaMock.facilityGroup.findMany.mockResolvedValue([]);
      prismaMock.facilityGroup.count.mockResolvedValue(0);

      const query = Object.assign(new QueryFacilitiesDto(), { minCapacity: 30 });
      await service.list(query);

      const exclusiveWhere = prismaMock.facility.findMany.mock.calls[0][0].where as Record<string, unknown>;
      expect(exclusiveWhere['capacity']).toEqual({ gte: 30 });
    });

    it('menghitung skip dari page dan limit yang diberikan', async () => {
      prismaMock.facility.findMany.mockResolvedValue([]);
      prismaMock.facility.count.mockResolvedValue(0);
      prismaMock.facilityGroup.findMany.mockResolvedValue([]);
      prismaMock.facilityGroup.count.mockResolvedValue(0);

      const query = Object.assign(new QueryFacilitiesDto(), {
        page: 3,
        limit: 10,
      });
      await service.list(query);

      expect(prismaMock.facility.findMany.mock.calls[0][0].skip).toBe(20);
      expect(prismaMock.facility.findMany.mock.calls[0][0].take).toBe(10);
    });
  });

  // ── detail ────────────────────────────────────────────────────────────────

  describe('detail', () => {
    it('mengembalikan detail unit EXCLUSIVE', async () => {
      prismaMock.facility.findFirst.mockResolvedValue(stubExclusiveFacility);
      const result = await service.detail('fac-1', 'unit');
      expect(result.kind).toBe('EXCLUSIVE');
      expect(result.id).toBe('fac-1');
    });

    it('melempar NotFoundException bila unit EXCLUSIVE tidak ada', async () => {
      prismaMock.facility.findFirst.mockResolvedValue(null);
      await expect(service.detail('not-exist', 'unit')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('mengembalikan detail kelompok QUANTITY', async () => {
      prismaMock.facilityGroup.findFirst.mockResolvedValue(stubQuantityGroup);
      const result = await service.detail('grp-qty-1', 'group');
      expect(result.kind).toBe('QUANTITY');
      expect((result as { activeUnits: number }).activeUnits).toBe(5);
    });

    it('melempar NotFoundException bila kelompok QUANTITY tidak ada', async () => {
      prismaMock.facilityGroup.findFirst.mockResolvedValue(null);
      await expect(service.detail('not-exist', 'group')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getAvailability ────────────────────────────────────────────────────────

  describe('getAvailability', () => {
    const mondayDate = '2026-09-21'; // Hari Senin (hari kerja)
    const sundayDate = '2026-09-20'; // Hari Minggu (non-operasional)

    describe('EXCLUSIVE unit', () => {
      it('mengembalikan 26 slot dengan status available=true jika tidak ada bentrok pada hari kerja', async () => {
        prismaMock.facility.findFirst.mockResolvedValue(stubExclusiveFacility);
        prismaMock.reservation.findMany.mockResolvedValue([]);
        prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

        const result = await service.getAvailability('fac-1', {
          date: mondayDate,
          kind: 'unit',
        });

        expect(result.kind).toBe('EXCLUSIVE');
        expect(result.isOperationalDay).toBe(true);
        expect(result.slots).toHaveLength(26);
        expect(result.slots[0].startTime).toBe('07:00');
        expect(result.slots[0].endTime).toBe('07:30');
        expect(result.slots[0].available).toBe(true);
        expect(result.slots.every((s) => s.available)).toBe(true);
      });

      it('menandai semua slot available=false dengan reason NON_OPERATIONAL_DAY pada akhir pekan', async () => {
        prismaMock.facility.findFirst.mockResolvedValue(stubExclusiveFacility);

        const result = await service.getAvailability('fac-1', {
          date: sundayDate,
          kind: 'unit',
        });

        expect(result.isOperationalDay).toBe(false);
        expect(result.slots).toHaveLength(26);
        expect(
          result.slots.every(
            (s) => !s.available && s.reason === 'NON_OPERATIONAL_DAY',
          ),
        ).toBe(true);
      });

      it('menandai slot yang bertabrakan dengan reservasi APPROVED sebagai available=false dengan reason RESERVED', async () => {
        prismaMock.facility.findFirst.mockResolvedValue(stubExclusiveFacility);
        // Reservasi jam 08:00 - 09:00 WIB (slot index 2 & 3)
        prismaMock.reservation.findMany.mockResolvedValue([
          {
            startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
            endTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
          },
        ]);
        prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

        const result = await service.getAvailability('fac-1', {
          date: mondayDate,
          kind: 'unit',
        });

        const slot0800 = result.slots.find((s) => s.startTime === '08:00')!;
        const slot0830 = result.slots.find((s) => s.startTime === '08:30')!;
        const slot0900 = result.slots.find((s) => s.startTime === '09:00')!;

        expect(slot0800.available).toBe(false);
        expect(slot0800.reason).toBe('RESERVED');
        expect(slot0830.available).toBe(false);
        expect(slot0830.reason).toBe('RESERVED');
        expect(slot0900.available).toBe(true);
      });

      it('menandai slot yang bertabrakan dengan maintenance period sebagai available=false dengan reason MAINTENANCE', async () => {
        prismaMock.facility.findFirst.mockResolvedValue(stubExclusiveFacility);
        prismaMock.reservation.findMany.mockResolvedValue([]);
        // Maintenance jam 10:00 - 12:00 WIB (03:00 - 05:00 UTC)
        prismaMock.maintenancePeriod.findMany.mockResolvedValue([
          {
            startAt: new Date(Date.UTC(2026, 8, 21, 3, 0, 0)),
            endAt: new Date(Date.UTC(2026, 8, 21, 5, 0, 0)),
          },
        ]);

        const result = await service.getAvailability('fac-1', {
          date: mondayDate,
          kind: 'unit',
        });

        const slot1000 = result.slots.find((s) => s.startTime === '10:00')!;
        expect(slot1000.available).toBe(false);
        expect(slot1000.reason).toBe('MAINTENANCE');
      });

      it('melempar NotFoundException bila unit tidak ditemukan', async () => {
        prismaMock.facility.findFirst.mockResolvedValue(null);
        await expect(
          service.getAvailability('unknown-id', {
            date: mondayDate,
            kind: 'unit',
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('QUANTITY group', () => {
      const groupWithUnits = {
        id: 'grp-qty-1',
        name: 'Proyektor Epson EB-X06',
        reservationMode: ReservationMode.QUANTITY,
        facilities: [{ id: 'unit-1', assetCode: 'PRJ-001' }, { id: 'unit-2', assetCode: 'PRJ-002' }],
      };

      it('menghitung availableUnits = totalActiveUnits dikurangi unit reservasi dan maintenance', async () => {
        prismaMock.facilityGroup.findFirst.mockResolvedValue(groupWithUnits);
        // Reservasi 1 unit jam 07:00 - 08:00
        prismaMock.reservation.findMany.mockResolvedValue([
          {
            startTime: new Date(Date.UTC(1970, 0, 1, 7, 0, 0)),
            endTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
            requestedQuantity: 1,
          },
        ]);
        prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

        const result = await service.getAvailability('grp-qty-1', {
          date: mondayDate,
          kind: 'group',
        });

        expect(result.kind).toBe('QUANTITY');
        expect(result.totalActiveUnits).toBe(2);

        const slot0700 = result.slots.find((s) => s.startTime === '07:00')!;
        expect(slot0700.totalUnits).toBe(2);
        expect(slot0700.availableUnits).toBe(1); // 2 - 1 = 1
        expect(slot0700.available).toBe(true);

        const slot0800 = result.slots.find((s) => s.startTime === '08:00')!;
        expect(slot0800.availableUnits).toBe(2);
      });

      it('melempar NotFoundException bila kelompok tidak ditemukan', async () => {
        prismaMock.facilityGroup.findFirst.mockResolvedValue(null);
        await expect(
          service.getAvailability('unknown-group', {
            date: mondayDate,
            kind: 'group',
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  describe('adminCreateGroup', () => {
    const adminId = 'admin-uuid-1';

    it('berhasil membuat grup baru dan mencatat audit log', async () => {
      prismaMock.facilityType.findUnique.mockResolvedValue(stubType);
      prismaMock.location.findUnique.mockResolvedValue(stubLocation);
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facilityGroup: {
              create: jest.fn().mockResolvedValue(stubQuantityGroup),
            },
            facility: { create: jest.fn() },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          }),
      );

      const result = await service.adminCreateGroup(adminId, {
        name: 'Proyektor Epson',
        facilityTypeId: 'type-1',
        reservationMode: ReservationMode.QUANTITY,
        locationId: 'loc-1',
        primaryImageUrl: 'https://example.com/img.jpg',
      });

      expect(result.id).toBe('grp-qty-1');
    });

    it('melempar NotFoundException bila facilityTypeId tidak valid', async () => {
      prismaMock.facilityType.findUnique.mockResolvedValue(null);

      await expect(
        service.adminCreateGroup(adminId, {
          name: 'Ruang 101',
          facilityTypeId: 'non-existent',
          reservationMode: ReservationMode.EXCLUSIVE,
          primaryImageUrl: 'https://example.com/img.jpg',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminCreateUnit', () => {
    const adminId = 'admin-uuid-1';

    it('berhasil membuat unit fisik baru bila assetCode belum terpakai', async () => {
      prismaMock.facilityGroup.findUnique.mockResolvedValue(stubQuantityGroup);
      prismaMock.facility.findUnique.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facility: {
              create: jest
                .fn()
                .mockResolvedValue({ id: 'u-1', assetCode: 'PRJ-099' }),
            },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          }),
      );

      const result = await service.adminCreateUnit(adminId, {
        facilityGroupId: 'grp-qty-1',
        assetCode: 'PRJ-099',
      });

      expect(result.assetCode).toBe('PRJ-099');
    });
  });

  describe('adminList', () => {
    it('mengembalikan seluruh grup fasilitas beserta unit fisiknya', async () => {
      prismaMock.facilityGroup.findMany.mockResolvedValue([stubQuantityGroup]);
      const result = await service.adminList();
      expect(result).toHaveLength(1);
    });
  });
});
