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
  facilityType: { findMany: jest.fn() },
  location: { findMany: jest.fn() },
  facility: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  facilityGroup: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
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
});
