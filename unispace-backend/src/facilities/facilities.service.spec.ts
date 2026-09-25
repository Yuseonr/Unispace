import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { ReservationMode, FacilityStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FacilityManagementService } from './admin/facility-management.service';
import { FacilityMasterService } from './admin/facility-master.service';
import { FacilityStatusService } from './admin/facility-status.service';
import { FacilityAvailabilityService } from './catalog/facility-availability.service';
import { FacilityCatalogService } from './catalog/facility-catalog.service';
import {
  FacilityImageStorageService,
  type FacilityImageUpload,
} from './facility-image-storage.service';
import { QueryFacilitiesDto } from './dto/catalog';

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const stubType = { id: 'type-1', name: 'Ruang Kelas' };
const stubArea = {
  id: 'area-1',
  code: 'FT',
  name: 'Fakultas Teknik',
  status: 'ACTIVE',
};

const stubExclusiveGroup = {
  id: 'grp-ex-1',
  name: 'Ruang 101',
  reservationMode: ReservationMode.EXCLUSIVE,
  facilityType: stubType,
  facilityArea: stubArea,
  locationDetail: 'Gedung A, Lantai 1, Ruang 101',
};

const stubExclusiveFacility = {
  id: 'fac-1',
  assetCode: 'R-101',
  name: 'Ruang Kelas 101',
  capacity: 40,
  description: 'Ruang kelas standar',
  primaryImageUrl: 'https://example.com/r101.jpg',
  status: FacilityStatus.ACTIVE,
  maintenancePeriods: [],
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
  facilityArea: stubArea,
  locationDetail: 'Pusat Media, Gedung A, Lantai 1',
  _count: { facilities: 5 },
  facilities: [],
};

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------

const prismaMock = {
  facilityType: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  facilityArea: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  facility: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  facilityGroup: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  reservation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  maintenancePeriod: { findMany: jest.fn(), findFirst: jest.fn() },
  facilityStatusHistory: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};

const imageStorageMock = {
  uploadPrimaryImage: jest.fn(),
};

const primaryImage = {
  buffer: Buffer.from('facility-image'),
  size: 14,
  mimetype: 'image/jpeg',
} as FacilityImageUpload;

const storedImage = {
  fileName: '11111111-1111-1111-1111-111111111111.jpg',
  objectKey: 'facility-primary/11111111-1111-1111-1111-111111111111.jpg',
  url: 'http://localhost:3001/api/v1/facilities/images/11111111-1111-1111-1111-111111111111.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 14,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('facility domain services', () => {
  let catalog: FacilityCatalogService;
  let availability: FacilityAvailabilityService;
  let master: FacilityMasterService;
  let management: FacilityManagementService;
  let status: FacilityStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacilityCatalogService,
        FacilityAvailabilityService,
        FacilityMasterService,
        FacilityManagementService,
        FacilityStatusService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FacilityImageStorageService, useValue: imageStorageMock },
      ],
    }).compile();

    catalog = module.get<FacilityCatalogService>(FacilityCatalogService);
    availability = module.get<FacilityAvailabilityService>(
      FacilityAvailabilityService,
    );
    master = module.get<FacilityMasterService>(FacilityMasterService);
    management = module.get<FacilityManagementService>(
      FacilityManagementService,
    );
    status = module.get<FacilityStatusService>(FacilityStatusService);
    jest.clearAllMocks();
    imageStorageMock.uploadPrimaryImage.mockResolvedValue(storedImage);
  });

  // ── listTypes ──────────────────────────────────────────────────────────────

  describe('listTypes', () => {
    it('mengembalikan daftar tipe fasilitas terurut A–Z', async () => {
      prismaMock.facilityType.findMany.mockResolvedValue([stubType]);
      const result = await master.listTypes();
      expect(result).toEqual([stubType]);
      expect(prismaMock.facilityType.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  // ── listAreas ─────────────────────────────────────────────────────────────

  describe('listAreas', () => {
    it('mengembalikan daftar fakultas/area kampus aktif terurut A–Z', async () => {
      prismaMock.facilityArea.findMany.mockResolvedValue([stubArea]);
      const result = await master.listActiveAreas();
      expect(result).toEqual([stubArea]);
      expect(prismaMock.facilityArea.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      });
    });
  });

  // ── Admin master type & area ──────────────────────────────────────────────

  describe('admin master data', () => {
    const adminId = 'admin-uuid-1';

    it('membuat tipe fasilitas dan mencatat audit log', async () => {
      const createdType = { id: 'type-2', name: 'Laboratorium' };
      const auditCreate = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facilityType: { create: jest.fn().mockResolvedValue(createdType) },
            auditLog: { create: auditCreate },
          }),
      );

      await expect(
        master.adminCreateType(adminId, { name: 'Laboratorium' }),
      ).resolves.toEqual(createdType);
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'FACILITY_TYPE_CREATED' }),
        }),
      );
    });

    it('memperbarui tipe fasilitas yang ada dan menolak tipe yang tidak ditemukan', async () => {
      prismaMock.facilityType.findUnique.mockResolvedValue(stubType);
      const auditCreate = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facilityType: {
              update: jest
                .fn()
                .mockResolvedValue({ ...stubType, name: 'Aula Serbaguna' }),
            },
            auditLog: { create: auditCreate },
          }),
      );

      await expect(
        master.adminUpdateType(adminId, stubType.id, {
          name: 'Aula Serbaguna',
        }),
      ).resolves.toMatchObject({ name: 'Aula Serbaguna' });
      expect(auditCreate).toHaveBeenCalled();

      prismaMock.facilityType.findUnique.mockResolvedValue(null);
      await expect(
        master.adminUpdateType(adminId, 'unknown-type', {
          name: 'Tidak Ada',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('menolak menonaktifkan area yang masih direferensikan grup fasilitas', async () => {
      prismaMock.facilityArea.findUnique.mockResolvedValue({
        ...stubArea,
        _count: { facilityGroups: 1 },
      });

      await expect(
        master.adminUpdateAreaStatus(adminId, stubArea.id, 'NONACTIVE'),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('menonaktifkan area kosong dan mencatat perubahan status', async () => {
      prismaMock.facilityArea.findUnique.mockResolvedValue({
        ...stubArea,
        _count: { facilityGroups: 0 },
      });
      const auditCreate = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facilityArea: {
              update: jest
                .fn()
                .mockResolvedValue({ ...stubArea, status: 'NONACTIVE' }),
            },
            auditLog: { create: auditCreate },
          }),
      );

      const result = await master.adminUpdateAreaStatus(
        adminId,
        stubArea.id,
        'NONACTIVE',
      );

      expect(result.status).toBe('NONACTIVE');
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'FACILITY_AREA_DEACTIVATED',
          }),
        }),
      );
    });

    it('membuat area dengan code dan nama unik', async () => {
      const auditCreate = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facilityArea: {
              create: jest.fn().mockResolvedValue({
                id: 'area-2',
                code: 'REKTORAT',
                name: 'Rektorat',
                status: 'ACTIVE',
              }),
            },
            auditLog: { create: auditCreate },
          }),
      );

      await expect(
        master.adminCreateArea(adminId, {
          code: 'REKTORAT',
          name: 'Rektorat',
        }),
      ).resolves.toMatchObject({ code: 'REKTORAT', name: 'Rektorat' });
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'FACILITY_AREA_CREATED' }),
        }),
      );
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
      const result = await catalog.list(query);

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
      await catalog.list(query);

      // filter harus ada di where yang dikirim ke Prisma
      const exclusiveWhere = prismaMock.facility.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
      const groupWhere = exclusiveWhere['facilityGroup'] as Record<
        string,
        unknown
      >;
      expect(groupWhere['facilityTypeId']).toBe('type-1');
    });

    it('meneruskan filter facilityAreaId ke Prisma', async () => {
      prismaMock.facility.findMany.mockResolvedValue([]);
      prismaMock.facility.count.mockResolvedValue(0);
      prismaMock.facilityGroup.findMany.mockResolvedValue([]);
      prismaMock.facilityGroup.count.mockResolvedValue(0);

      const query = Object.assign(new QueryFacilitiesDto(), {
        facilityAreaId: 'area-1',
      });
      await catalog.list(query);

      const exclusiveWhere = prismaMock.facility.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
      const groupWhere = exclusiveWhere['facilityGroup'] as Record<
        string,
        unknown
      >;
      expect(groupWhere['facilityAreaId']).toBe('area-1');
    });

    it('meneruskan filter minCapacity ke Prisma', async () => {
      prismaMock.facility.findMany.mockResolvedValue([]);
      prismaMock.facility.count.mockResolvedValue(0);
      prismaMock.facilityGroup.findMany.mockResolvedValue([]);
      prismaMock.facilityGroup.count.mockResolvedValue(0);

      const query = Object.assign(new QueryFacilitiesDto(), {
        minCapacity: 30,
      });
      await catalog.list(query);

      const exclusiveWhere = prismaMock.facility.findMany.mock.calls[0][0]
        .where as Record<string, unknown>;
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
      await catalog.list(query);

      expect(prismaMock.facility.findMany.mock.calls[0][0].skip).toBe(20);
      expect(prismaMock.facility.findMany.mock.calls[0][0].take).toBe(10);
    });
  });

  // ── detail ────────────────────────────────────────────────────────────────

  describe('detail', () => {
    it('mengembalikan detail unit EXCLUSIVE', async () => {
      prismaMock.facility.findFirst.mockResolvedValue(stubExclusiveFacility);
      const result = await catalog.detail('fac-1', 'unit');
      expect(result.kind).toBe('EXCLUSIVE');
      expect(result.id).toBe('fac-1');
    });

    it('menampilkan maintenance mendatang tanpa mengubah status ACTIVE saat ini', async () => {
      const nextStart = new Date('2026-10-01T03:00:00.000Z');
      const nextEnd = new Date('2026-10-01T05:00:00.000Z');
      prismaMock.facility.findFirst.mockResolvedValue({
        ...stubExclusiveFacility,
        maintenancePeriods: [{ startAt: nextStart, endAt: nextEnd }],
      });

      const result = await catalog.detail('fac-1', 'unit');

      expect(result.status).toBe(FacilityStatus.ACTIVE);
      expect(result.nextMaintenance).toEqual({
        startAt: nextStart,
        endAt: nextEnd,
      });
    });

    it('melempar NotFoundException bila unit EXCLUSIVE tidak ada', async () => {
      prismaMock.facility.findFirst.mockResolvedValue(null);
      await expect(catalog.detail('not-exist', 'unit')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('mengembalikan detail kelompok QUANTITY', async () => {
      prismaMock.facilityGroup.findFirst.mockResolvedValue(stubQuantityGroup);
      const result = await catalog.detail('grp-qty-1', 'group');
      expect(result.kind).toBe('QUANTITY');
      expect((result as { activeUnits: number }).activeUnits).toBe(5);
    });

    it('melempar NotFoundException bila kelompok QUANTITY tidak ada', async () => {
      prismaMock.facilityGroup.findFirst.mockResolvedValue(null);
      await expect(catalog.detail('not-exist', 'group')).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.facilityGroup.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            facilities: { some: { status: FacilityStatus.ACTIVE } },
          }),
        }),
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

        const result = await availability.getAvailability('fac-1', {
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

        const result = await availability.getAvailability('fac-1', {
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

        const result = await availability.getAvailability('fac-1', {
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

        const result = await availability.getAvailability('fac-1', {
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
          availability.getAvailability('unknown-id', {
            date: mondayDate,
            kind: 'unit',
          }),
        ).rejects.toThrow(NotFoundException);
        expect(prismaMock.facility.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ status: FacilityStatus.ACTIVE }),
          }),
        );
      });
    });

    describe('QUANTITY group', () => {
      const groupWithUnits = {
        id: 'grp-qty-1',
        name: 'Proyektor Epson EB-X06',
        reservationMode: ReservationMode.QUANTITY,
        facilities: [
          { id: 'unit-1', assetCode: 'PRJ-001' },
          { id: 'unit-2', assetCode: 'PRJ-002' },
        ],
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

        const result = await availability.getAvailability('grp-qty-1', {
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
          availability.getAvailability('unknown-group', {
            date: mondayDate,
            kind: 'group',
          }),
        ).rejects.toThrow(NotFoundException);
        expect(prismaMock.facilityGroup.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              facilities: { some: { status: FacilityStatus.ACTIVE } },
            }),
          }),
        );
      });
    });
  });

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  describe('adminCreateGroup', () => {
    const adminId = 'admin-uuid-1';

    it('berhasil membuat grup baru dan mencatat audit log', async () => {
      prismaMock.facilityType.findUnique.mockResolvedValue(stubType);
      prismaMock.facilityArea.findFirst.mockResolvedValue(stubArea);
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

      const result = await management.adminCreateGroup(
        adminId,
        {
          name: 'Proyektor Epson',
          facilityTypeId: 'type-1',
          reservationMode: ReservationMode.QUANTITY,
          facilityAreaId: 'area-1',
          locationDetail: 'Pusat Media, Gedung A, Lantai 1',
        },
        primaryImage,
      );

      expect(result.id).toBe('grp-qty-1');
      expect(imageStorageMock.uploadPrimaryImage).toHaveBeenCalledWith(
        primaryImage,
      );
    });

    it('melempar NotFoundException bila facilityTypeId tidak valid', async () => {
      prismaMock.facilityType.findUnique.mockResolvedValue(null);

      await expect(
        management.adminCreateGroup(
          adminId,
          {
            name: 'Ruang 101',
            facilityTypeId: 'non-existent',
            reservationMode: ReservationMode.EXCLUSIVE,
            facilityAreaId: 'area-1',
            locationDetail: 'Gedung A, Lantai 1, Ruang 101',
          },
          primaryImage,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('mewajibkan kode aset ketika membuat fasilitas EXCLUSIVE', async () => {
      prismaMock.facilityType.findUnique.mockResolvedValue(stubType);
      prismaMock.facilityArea.findFirst.mockResolvedValue(stubArea);

      await expect(
        management.adminCreateGroup(
          adminId,
          {
            name: 'Ruang 101',
            facilityTypeId: 'type-1',
            reservationMode: ReservationMode.EXCLUSIVE,
            facilityAreaId: 'area-1',
            locationDetail: 'Gedung A, Lantai 1, Ruang 101',
          },
          primaryImage,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(imageStorageMock.uploadPrimaryImage).not.toHaveBeenCalled();
    });

    it('membuat tepat satu unit awal EXCLUSIVE dengan metadata dan foto katalog', async () => {
      prismaMock.facilityType.findUnique.mockResolvedValue(stubType);
      prismaMock.facilityArea.findFirst.mockResolvedValue(stubArea);
      prismaMock.facility.findUnique.mockResolvedValue(null);
      const initialUnitCreate = jest.fn().mockResolvedValue({
        id: 'fac-new',
        assetCode: 'AULA-001',
      });
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facilityGroup: {
              create: jest.fn().mockResolvedValue({
                ...stubExclusiveGroup,
                id: 'grp-new',
              }),
            },
            facility: { create: initialUnitCreate },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          }),
      );

      const result = await management.adminCreateGroup(
        adminId,
        {
          name: 'Aula Baru',
          facilityTypeId: stubType.id,
          reservationMode: ReservationMode.EXCLUSIVE,
          facilityAreaId: stubArea.id,
          locationDetail: 'Gedung A, Lantai 1',
          capacity: 200,
          assetCode: 'AULA-001',
        },
        primaryImage,
      );

      expect(result.initialUnit).toMatchObject({ assetCode: 'AULA-001' });
      expect(initialUnitCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            facilityGroupId: 'grp-new',
            assetCode: 'AULA-001',
            name: 'Aula Baru',
            capacity: 200,
            primaryImageUrl: storedImage.url,
          }),
        }),
      );
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

      const result = await management.adminCreateUnit(adminId, {
        facilityGroupId: 'grp-qty-1',
        assetCode: 'PRJ-099',
      });

      expect(result.assetCode).toBe('PRJ-099');
    });

    it('menolak penambahan unit kedua pada kelompok EXCLUSIVE', async () => {
      prismaMock.facilityGroup.findUnique.mockResolvedValue(stubExclusiveGroup);

      await expect(
        management.adminCreateUnit(adminId, {
          facilityGroupId: stubExclusiveGroup.id,
          assetCode: 'R-102',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('adminUpdateGroup dan adminUpdateUnit', () => {
    const adminId = 'admin-uuid-1';

    it('menyelaraskan metadata grup EXCLUSIVE ke unit fisik tunggal', async () => {
      prismaMock.facilityGroup.findUnique.mockResolvedValue(stubExclusiveGroup);
      const groupUpdate = jest
        .fn()
        .mockResolvedValue({ ...stubExclusiveGroup, name: 'Ruang 102' });
      const unitUpdate = jest.fn().mockResolvedValue({});
      const auditCreate = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facilityGroup: { update: groupUpdate },
            facility: {
              findFirst: jest.fn().mockResolvedValue({ id: 'fac-1' }),
              update: unitUpdate,
            },
            auditLog: { create: auditCreate },
          }),
      );

      await management.adminUpdateGroup(adminId, stubExclusiveGroup.id, {
        name: 'Ruang 102',
        capacity: 45,
      });

      expect(unitUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fac-1' },
          data: { name: 'Ruang 102', capacity: 45 },
        }),
      );
      expect(auditCreate).toHaveBeenCalled();
    });

    it('menolak foto atau metadata kartu pada satuan unit QUANTITY', async () => {
      prismaMock.facility.findUnique.mockResolvedValue({
        ...stubExclusiveFacility,
        facilityGroup: stubQuantityGroup,
      });

      await expect(
        management.adminUpdateUnit(
          adminId,
          'fac-1',
          { description: 'Tidak boleh di unit' },
          primaryImage,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(imageStorageMock.uploadPrimaryImage).not.toHaveBeenCalled();
    });

    it('menyelaraskan perubahan unit EXCLUSIVE ke metadata grup katalog', async () => {
      prismaMock.facility.findUnique.mockResolvedValue({
        ...stubExclusiveFacility,
        facilityGroupId: stubExclusiveGroup.id,
      });
      const groupUpdate = jest.fn().mockResolvedValue({});
      const unitUpdate = jest
        .fn()
        .mockResolvedValue({ ...stubExclusiveFacility, name: 'Aula Utama' });
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facility: { update: unitUpdate },
            facilityGroup: { update: groupUpdate },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          }),
      );

      await management.adminUpdateUnit(
        adminId,
        stubExclusiveFacility.id,
        { name: 'Aula Utama', capacity: 250 },
        primaryImage,
      );

      expect(groupUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: stubExclusiveGroup.id },
          data: {
            name: 'Aula Utama',
            capacity: 250,
            primaryImageUrl: storedImage.url,
          },
        }),
      );
    });
  });

  describe('adminList', () => {
    it('mengembalikan seluruh grup fasilitas beserta unit fisiknya', async () => {
      prismaMock.facilityGroup.findMany.mockResolvedValue([stubQuantityGroup]);
      const result = await management.adminList();
      expect(result).toHaveLength(1);
    });
  });

  describe('adminUpdateUnitStatus', () => {
    const adminId = 'admin-uuid-1';
    const facilityId = 'fac-1';

    it('menolak status IN_MAINTENANCE yang ditetapkan langsung oleh admin', async () => {
      await expect(
        status.adminUpdateUnitStatus(
          adminId,
          facilityId,
          FacilityStatus.IN_MAINTENANCE,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.facility.findUnique).not.toHaveBeenCalled();
    });

    it('menolak penonaktifan fasilitas bila masih ada reservasi APPROVED yang belum selesai', async () => {
      prismaMock.facility.findUnique.mockResolvedValue({
        id: facilityId,
        assetCode: 'R-101',
        status: FacilityStatus.ACTIVE,
        facilityGroup: {
          name: 'Ruang 101',
          reservationMode: ReservationMode.EXCLUSIVE,
        },
      });
      // Ada reservasi APPROVED yang aktif
      prismaMock.reservation.findFirst.mockResolvedValue({
        id: 'res-approved-1',
      });

      await expect(
        status.adminUpdateUnitStatus(
          adminId,
          facilityId,
          FacilityStatus.NONACTIVE,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('berhasil menonaktifkan fasilitas dan menolak reservasi PENDING yang terkait', async () => {
      prismaMock.facility.findUnique.mockResolvedValue({
        id: facilityId,
        assetCode: 'R-101',
        status: FacilityStatus.ACTIVE,
        facilityGroup: {
          name: 'Ruang 101',
          reservationMode: ReservationMode.EXCLUSIVE,
        },
      });
      prismaMock.reservation.findFirst.mockResolvedValue(null);

      const updatedFacility = {
        id: facilityId,
        assetCode: 'R-101',
        status: FacilityStatus.NONACTIVE,
      };

      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facility: { update: jest.fn().mockResolvedValue(updatedFacility) },
            reservation: {
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            facilityStatusHistory: { create: jest.fn().mockResolvedValue({}) },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          }),
      );

      const result = await status.adminUpdateUnitStatus(
        adminId,
        facilityId,
        FacilityStatus.NONACTIVE,
      );

      expect(result.status).toBe(FacilityStatus.NONACTIVE);
    });

    it('berhasil mengaktifkan kembali fasilitas dari NONACTIVE ke ACTIVE', async () => {
      prismaMock.facility.findUnique.mockResolvedValue({
        id: facilityId,
        assetCode: 'R-101',
        status: FacilityStatus.NONACTIVE,
        facilityGroup: {
          name: 'Ruang 101',
          reservationMode: ReservationMode.EXCLUSIVE,
        },
      });

      const updatedFacility = {
        id: facilityId,
        assetCode: 'R-101',
        status: FacilityStatus.ACTIVE,
      };

      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facility: { update: jest.fn().mockResolvedValue(updatedFacility) },
            maintenancePeriod: { findFirst: jest.fn().mockResolvedValue(null) },
            facilityStatusHistory: { create: jest.fn().mockResolvedValue({}) },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          }),
      );

      const result = await status.adminUpdateUnitStatus(
        adminId,
        facilityId,
        FacilityStatus.ACTIVE,
      );

      expect(result.status).toBe(FacilityStatus.ACTIVE);
    });

    it('menjaga status IN_MAINTENANCE saat fasilitas diaktifkan kembali di tengah perbaikan', async () => {
      prismaMock.facility.findUnique.mockResolvedValue({
        id: facilityId,
        assetCode: 'R-101',
        status: FacilityStatus.NONACTIVE,
        facilityGroup: {
          name: 'Ruang 101',
          reservationMode: ReservationMode.EXCLUSIVE,
        },
      });

      const facilityUpdate = jest.fn().mockResolvedValue({
        id: facilityId,
        assetCode: 'R-101',
        status: FacilityStatus.IN_MAINTENANCE,
      });
      const historyCreate = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            facility: { update: facilityUpdate },
            maintenancePeriod: {
              findFirst: jest.fn().mockResolvedValue({ id: 'maintenance-1' }),
            },
            facilityStatusHistory: { create: historyCreate },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          }),
      );

      const result = await status.adminUpdateUnitStatus(
        adminId,
        facilityId,
        FacilityStatus.ACTIVE,
      );

      expect(result.status).toBe(FacilityStatus.IN_MAINTENANCE);
      expect(facilityUpdate).toHaveBeenCalledWith({
        where: { id: facilityId },
        data: { status: FacilityStatus.IN_MAINTENANCE },
      });
      expect(historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: FacilityStatus.IN_MAINTENANCE,
          }),
        }),
      );
    });
  });
});
