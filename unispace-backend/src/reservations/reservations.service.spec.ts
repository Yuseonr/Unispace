import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  AccountStatus,
  FacilityStatus,
  ReservationMode,
  ReservationStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ReservationsService } from './reservations.service';
import {
  addOperationalDays,
  formatToJakartaDateString,
} from './utils/reservation-time.util';

// ---------------------------------------------------------------------------
// Stub Data
// ---------------------------------------------------------------------------

const stubActiveUser = {
  id: 'user-uuid-1',
  name: 'Budi Santoso',
  identityNumber: '12345678',
  email: 'budi@kampus.ac.id',
  role: 'USER',
  accountStatus: AccountStatus.ACTIVE,
};

const stubArea = { id: 'area-1', code: 'FSM', name: 'Gedung Utama FSM' };

const stubExclusiveFacility = {
  id: 'fac-uuid-1',
  facilityGroupId: 'grp-uuid-1',
  assetCode: 'R-101',
  name: 'Ruang Aula 101',
  status: FacilityStatus.ACTIVE,
  facilityGroup: {
    id: 'grp-uuid-1',
    name: 'Gedung Serbaguna',
    reservationMode: ReservationMode.EXCLUSIVE,
    locationDetail: 'Lantai 1',
    facilityArea: stubArea,
    facilityType: { id: 'type-1', name: 'Ruang Seminar' },
  },
};

const stubQuantityGroup = {
  id: 'grp-qty-1',
  name: 'Proyektor Epson EB-X06',
  reservationMode: ReservationMode.QUANTITY,
  locationDetail: 'Lantai 1',
  facilityArea: stubArea,
  facilities: [
    { id: 'unit-1', assetCode: 'PRJ-001', status: FacilityStatus.ACTIVE },
    { id: 'unit-2', assetCode: 'PRJ-002', status: FacilityStatus.ACTIVE },
    { id: 'unit-3', assetCode: 'PRJ-003', status: FacilityStatus.ACTIVE },
  ],
  facilityType: { id: 'type-1', name: 'Alat Elektronik' },
};

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const prismaMock = {
  facility: { findUnique: jest.fn(), findMany: jest.fn() },
  facilityGroup: { findFirst: jest.fn() },
  reservation: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  reservationItem: {
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  },
  maintenancePeriod: { findFirst: jest.fn(), findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
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
    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
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

describe('ReservationsService - create', () => {
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
    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
  });

  it('berhasil mengajukan reservasi ruang eksklusif dan mencatat audit log', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00'); // Senin
    const usageDate = '2026-09-25'; // Jumat

    prismaMock.user.findUnique.mockResolvedValue(stubActiveUser);
    prismaMock.facility.findUnique.mockResolvedValue(stubExclusiveFacility);
    prismaMock.maintenancePeriod.findFirst.mockResolvedValue(null);
    prismaMock.reservation.findFirst.mockResolvedValue(null);

    const createdResStub = {
      id: 'res-uuid-1',
      userId: stubActiveUser.id,
      facilityId: stubExclusiveFacility.id,
      facilityGroupId: null,
      requestedQuantity: 1,
      usageDate: new Date('2026-09-25T00:00:00.000Z'),
      startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
      endTime: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)),
      purpose: 'Kegiatan Seminar Ilmiah Tahunan',
      status: ReservationStatus.PENDING,
      decisionDeadline: new Date('2026-09-22T20:00:00+07:00'),
    };
    prismaMock.reservation.create.mockResolvedValue(createdResStub);
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.create(
      stubActiveUser.id,
      {
        facilityId: stubExclusiveFacility.id,
        usageDate,
        startTime: '08:00',
        endTime: '10:00',
        purpose: 'Kegiatan Seminar Ilmiah Tahunan',
      },
      now,
    );

    expect(result).toMatchObject({
      id: 'res-uuid-1',
      status: ReservationStatus.PENDING,
      requestedQuantity: 1,
    });
    expect(prismaMock.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: stubActiveUser.id,
          facilityId: stubExclusiveFacility.id,
          facilityGroupId: null,
          requestedQuantity: 1,
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'RESERVATION_CREATED',
          actorId: stubActiveUser.id,
          entityId: 'res-uuid-1',
        }),
      }),
    );
  });

  it('berhasil mengajukan peminjaman kelompok alat (QUANTITY) dengan stok mencukupi', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00'); // Senin
    const usageDate = '2026-09-25'; // Jumat

    prismaMock.user.findUnique.mockResolvedValue(stubActiveUser);
    prismaMock.facilityGroup.findFirst.mockResolvedValue(stubQuantityGroup);
    prismaMock.reservation.findMany.mockResolvedValue([]);
    prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

    const createdResStub = {
      id: 'res-uuid-2',
      userId: stubActiveUser.id,
      facilityId: null,
      facilityGroupId: stubQuantityGroup.id,
      requestedQuantity: 2,
      usageDate: new Date('2026-09-25T00:00:00.000Z'),
      startTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
      endTime: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
      purpose: 'Praktikum Lapangan Elektronika',
      status: ReservationStatus.PENDING,
      decisionDeadline: new Date('2026-09-22T20:00:00+07:00'),
    };
    prismaMock.reservation.create.mockResolvedValue(createdResStub);
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-2' });

    const result = await service.create(
      stubActiveUser.id,
      {
        facilityGroupId: stubQuantityGroup.id,
        requestedQuantity: 2,
        usageDate,
        startTime: '09:00',
        endTime: '11:00',
        purpose: 'Praktikum Lapangan Elektronika',
      },
      now,
    );

    expect(result).toMatchObject({
      id: 'res-uuid-2',
      requestedQuantity: 2,
      status: ReservationStatus.PENDING,
    });
  });

  it('menolak pengajuan jika akun pemohon belum aktif atau berstatus ditolak/nonaktif', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...stubActiveUser,
      accountStatus: AccountStatus.PENDING_VERIFICATION,
    });

    await expect(
      service.create(stubActiveUser.id, {
        facilityId: stubExclusiveFacility.id,
        usageDate: '2026-09-25',
        startTime: '08:00',
        endTime: '10:00',
        purpose: 'Kegiatan Organisasi Kampus',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('menolak pengajuan jika waktu bukan kelipatan 30 menit atau di luar jam 07.00-20.00 WIB', async () => {
    prismaMock.user.findUnique.mockResolvedValue(stubActiveUser);

    // Bukan kelipatan 30 menit
    await expect(
      service.create(stubActiveUser.id, {
        facilityId: stubExclusiveFacility.id,
        usageDate: '2026-09-25',
        startTime: '08:15',
        endTime: '10:00',
        purpose: 'Seminar Teknologi Kampus',
      }),
    ).rejects.toThrow(BadRequestException);

    // Di luar batas jam operasional (sebelum 07.00)
    await expect(
      service.create(stubActiveUser.id, {
        facilityId: stubExclusiveFacility.id,
        usageDate: '2026-09-25',
        startTime: '06:30',
        endTime: '08:00',
        purpose: 'Seminar Teknologi Kampus',
      }),
    ).rejects.toThrow(BadRequestException);

    // Di luar batas jam operasional (setelah 20.00)
    await expect(
      service.create(stubActiveUser.id, {
        facilityId: stubExclusiveFacility.id,
        usageDate: '2026-09-25',
        startTime: '19:00',
        endTime: '20:30',
        purpose: 'Seminar Teknologi Kampus',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak pengajuan jika diajukan pada akhir pekan atau melanggar lead time H-2', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00'); // Senin
    prismaMock.user.findUnique.mockResolvedValue(stubActiveUser);

    // Akhir pekan (2026-09-27 = Minggu)
    await expect(
      service.create(
        stubActiveUser.id,
        {
          facilityId: stubExclusiveFacility.id,
          usageDate: '2026-09-27',
          startTime: '08:00',
          endTime: '10:00',
          purpose: 'Seminar Akhir Pekan Kampus',
        },
        now,
      ),
    ).rejects.toThrow(BadRequestException);

    // H-1 (2026-09-22 = Selasa, tidak memenuhi syarat minimal H-2 hari kerja)
    await expect(
      service.create(
        stubActiveUser.id,
        {
          facilityId: stubExclusiveFacility.id,
          usageDate: '2026-09-22',
          startTime: '08:00',
          endTime: '10:00',
          purpose: 'Seminar Dadakan Kampus',
        },
        now,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak pengajuan ruang jika bentrok dengan reservasi APPROVED atau maintenance', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00');
    prismaMock.user.findUnique.mockResolvedValue(stubActiveUser);
    prismaMock.facility.findUnique.mockResolvedValue(stubExclusiveFacility);

    // Kasus 1: Sedang Maintenance
    prismaMock.maintenancePeriod.findFirst.mockResolvedValue({
      id: 'maint-1',
      facilityId: stubExclusiveFacility.id,
    });
    await expect(
      service.create(
        stubActiveUser.id,
        {
          facilityId: stubExclusiveFacility.id,
          usageDate: '2026-09-25',
          startTime: '08:00',
          endTime: '10:00',
          purpose: 'Kegiatan Belajar Bersama',
        },
        now,
      ),
    ).rejects.toThrow('masa perbaikan');

    // Kasus 2: Bentrok dengan reservasi yang sudah APPROVED
    prismaMock.maintenancePeriod.findFirst.mockResolvedValue(null);
    prismaMock.reservation.findFirst.mockResolvedValue({
      id: 'res-existing-1',
      status: ReservationStatus.APPROVED,
    });
    await expect(
      service.create(
        stubActiveUser.id,
        {
          facilityId: stubExclusiveFacility.id,
          usageDate: '2026-09-25',
          startTime: '08:00',
          endTime: '10:00',
          purpose: 'Kegiatan Belajar Bersama',
        },
        now,
      ),
    ).rejects.toThrow('sudah dipesan');
  });

  it('menolak peminjaman alat jika unit tersedia tidak mencukupi permintaan', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00');
    prismaMock.user.findUnique.mockResolvedValue(stubActiveUser);
    prismaMock.facilityGroup.findFirst.mockResolvedValue(stubQuantityGroup); // Total 3 unit

    // Sudah terpakai 2 unit oleh reservasi lain pada jam 08.00 - 09.00
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
        endTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
        requestedQuantity: 2,
      },
    ]);
    prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

    // Pengguna meminta 2 unit (3 - 2 = sisa 1 unit, tidak cukup)
    await expect(
      service.create(
        stubActiveUser.id,
        {
          facilityGroupId: stubQuantityGroup.id,
          requestedQuantity: 2,
          usageDate: '2026-09-25',
          startTime: '08:00',
          endTime: '09:00',
          purpose: 'Peminjaman Proyektor Acara',
        },
        now,
      ),
    ).rejects.toThrow('Ketersediaan alat tidak mencukupi');
  });
});

describe('ReservationsService - listMy', () => {
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

  it('mengembalikan daftar riwayat terpaginasi milik pengguna', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00'); // Senin
    const stubResList = [
      {
        id: 'res-1',
        userId: stubActiveUser.id,
        facilityId: stubExclusiveFacility.id,
        facilityGroupId: stubExclusiveFacility.facilityGroup.id,
        requestedQuantity: 1,
        usageDate: new Date('2026-09-25T00:00:00.000Z'), // Jumat (H-4)
        startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
        endTime: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)),
        purpose: 'Kegiatan Rapat Organisasi',
        status: ReservationStatus.PENDING,
        facility: stubExclusiveFacility,
        facilityGroup: stubExclusiveFacility.facilityGroup,
        items: [],
      },
    ];

    prismaMock.reservation.count.mockResolvedValue(1);
    prismaMock.reservation.findMany.mockResolvedValue(stubResList);

    const result = await service.listMy(
      stubActiveUser.id,
      { page: 1, limit: 10 },
      now,
    );

    expect(result.meta).toEqual({
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    expect(result.data.length).toBe(1);
    expect(result.data[0].id).toBe('res-1');
    expect(result.data[0].canCancel).toBe(true);
    expect(result.data[0].allocatedAssets).toEqual([]);
  });

  it('menandai canCancel = false jika waktu sudah melewati cut-off atau status sudah selesai', async () => {
    // Sekarang hari Kamis 2026-09-24 pukul 21:00 WIB (sudah lewat batas 20.00 WIB pada H-1)
    const nowAfterCutoff = new Date('2026-09-24T21:00:00+07:00');
    const stubResList = [
      {
        id: 'res-cutoff',
        userId: stubActiveUser.id,
        facilityId: stubExclusiveFacility.id,
        facilityGroupId: stubExclusiveFacility.facilityGroup.id,
        requestedQuantity: 1,
        usageDate: new Date('2026-09-25T00:00:00.000Z'),
        startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
        endTime: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)),
        purpose: 'Kegiatan Rapat Organisasi',
        status: ReservationStatus.APPROVED,
        facility: stubExclusiveFacility,
        facilityGroup: stubExclusiveFacility.facilityGroup,
        items: [],
      },
    ];

    prismaMock.reservation.count.mockResolvedValue(1);
    prismaMock.reservation.findMany.mockResolvedValue(stubResList);

    const result = await service.listMy(
      stubActiveUser.id,
      { page: 1, limit: 10 },
      nowAfterCutoff,
    );

    expect(result.data[0].canCancel).toBe(false);
  });

  it('menyertakan daftar allocatedAssets jika reservasi berstatus APPROVED', async () => {
    const stubApprovedWithItems = [
      {
        id: 'res-approved-item',
        userId: stubActiveUser.id,
        facilityId: null,
        facilityGroupId: stubQuantityGroup.id,
        requestedQuantity: 1,
        usageDate: new Date('2026-09-25T00:00:00.000Z'),
        startTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
        endTime: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
        purpose: 'Peminjaman Alat Acara',
        status: ReservationStatus.APPROVED,
        facility: null,
        facilityGroup: stubQuantityGroup,
        items: [
          {
            facility: {
              id: 'unit-1',
              assetCode: 'PRJ-001',
              name: 'Proyektor Epson EB-X06 #1',
            },
          },
        ],
      },
    ];

    prismaMock.reservation.count.mockResolvedValue(1);
    prismaMock.reservation.findMany.mockResolvedValue(stubApprovedWithItems);

    const result = await service.listMy(stubActiveUser.id, {});

    expect(result.data[0].allocatedAssets).toEqual([
      {
        id: 'unit-1',
        assetCode: 'PRJ-001',
        name: 'Proyektor Epson EB-X06 #1',
      },
    ]);
  });
});

describe('ReservationsService - getMyDetail', () => {
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

  it('mengembalikan rincian lengkap reservasi milik pengguna', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00');
    const stubDetail = {
      id: 'res-detail-1',
      userId: stubActiveUser.id,
      facilityId: stubExclusiveFacility.id,
      facilityGroupId: stubExclusiveFacility.facilityGroup.id,
      requestedQuantity: 1,
      usageDate: new Date('2026-09-25T00:00:00.000Z'),
      startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
      endTime: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)),
      purpose: 'Kuliah Tamu Industri',
      status: ReservationStatus.APPROVED,
      facility: stubExclusiveFacility,
      facilityGroup: stubExclusiveFacility.facilityGroup,
      processedBy: {
        id: 'staff-1',
        name: 'Petugas Joko',
        email: 'joko@kampus.ac.id',
      },
      items: [],
    };

    prismaMock.reservation.findFirst.mockResolvedValue(stubDetail);

    const result = await service.getMyDetail(
      stubActiveUser.id,
      'res-detail-1',
      now,
    );

    expect(result.id).toBe('res-detail-1');
    expect(result.purpose).toBe('Kuliah Tamu Industri');
    expect(result.canCancel).toBe(true);
    expect(prismaMock.reservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-detail-1', userId: stubActiveUser.id },
      }),
    );
  });

  it('melemparkan NotFoundException jika reservasi tidak ditemukan atau milik pengguna lain', async () => {
    prismaMock.reservation.findFirst.mockResolvedValue(null);

    await expect(
      service.getMyDetail(stubActiveUser.id, 'res-bukan-milik-saya'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ReservationsService - cancelMy', () => {
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
    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );
  });

  it('berhasil membatalkan reservasi PENDING sebelum cut-off', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00'); // Senin
    const stubPending = {
      id: 'res-cancel-pending',
      userId: stubActiveUser.id,
      status: ReservationStatus.PENDING,
      usageDate: new Date('2026-09-25T00:00:00.000Z'), // Jumat (H-4)
    };

    prismaMock.reservation.findFirst.mockResolvedValue(stubPending);
    prismaMock.reservation.update.mockResolvedValue({
      ...stubPending,
      status: ReservationStatus.CANCELLED_BY_USER,
      cancelledAt: now,
    });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-cancel-1' });

    const result = await service.cancelMy(
      stubActiveUser.id,
      'res-cancel-pending',
      now,
    );

    expect(result.status).toBe(ReservationStatus.CANCELLED_BY_USER);
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-cancel-pending' },
        data: expect.objectContaining({
          status: ReservationStatus.CANCELLED_BY_USER,
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'RESERVATION_CANCELLED_BY_USER',
          entityId: 'res-cancel-pending',
        }),
      }),
    );
  });

  it('berhasil membatalkan reservasi APPROVED sebelum cut-off', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00'); // Senin
    const stubApproved = {
      id: 'res-cancel-approved',
      userId: stubActiveUser.id,
      status: ReservationStatus.APPROVED,
      usageDate: new Date('2026-09-25T00:00:00.000Z'),
    };

    prismaMock.reservation.findFirst.mockResolvedValue(stubApproved);
    prismaMock.reservation.update.mockResolvedValue({
      ...stubApproved,
      status: ReservationStatus.CANCELLED_BY_USER,
      cancelledAt: now,
    });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-cancel-2' });

    const result = await service.cancelMy(
      stubActiveUser.id,
      'res-cancel-approved',
      now,
    );

    expect(result.status).toBe(ReservationStatus.CANCELLED_BY_USER);
  });

  it('menolak pembatalan jika waktu sudah melewati batas cut-off H-1 20.00 WIB', async () => {
    // Penggunaan Jumat 2026-09-25 -> Cutoff: Kamis 2026-09-24 pukul 20.00 WIB
    // Mencoba membatalkan Kamis 2026-09-24 pukul 20.15 WIB (terlambat)
    const lateNow = new Date('2026-09-24T20:15:00+07:00');
    const stubApproved = {
      id: 'res-cancel-late',
      userId: stubActiveUser.id,
      status: ReservationStatus.APPROVED,
      usageDate: new Date('2026-09-25T00:00:00.000Z'),
    };

    prismaMock.reservation.findFirst.mockResolvedValue(stubApproved);

    await expect(
      service.cancelMy(stubActiveUser.id, 'res-cancel-late', lateNow),
    ).rejects.toThrow('Batas waktu pembatalan mandiri telah terlewati');
  });

  it('menolak pembatalan jika status reservasi bukan PENDING atau APPROVED (misal REJECTED)', async () => {
    const now = new Date('2026-09-21T08:00:00+07:00');
    const stubRejected = {
      id: 'res-cancel-rejected',
      userId: stubActiveUser.id,
      status: ReservationStatus.REJECTED,
      usageDate: new Date('2026-09-25T00:00:00.000Z'),
    };

    prismaMock.reservation.findFirst.mockResolvedValue(stubRejected);

    await expect(
      service.cancelMy(stubActiveUser.id, 'res-cancel-rejected', now),
    ).rejects.toThrow('tidak dapat dibatalkan');
  });

  it('melemparkan NotFoundException jika reservasi tidak ditemukan atau milik user lain', async () => {
    prismaMock.reservation.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelMy(stubActiveUser.id, 'res-non-existent'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ReservationsService - listStaff & getStaffDetail', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('mengambil antrean reservasi petugas dengan paginasi dan filter status PENDING terurut decisionDeadline asc', async () => {
    const stubItems = [
      {
        id: 'res-staff-1',
        userId: stubActiveUser.id,
        facilityId: stubExclusiveFacility.id,
        facilityGroupId: null,
        status: ReservationStatus.PENDING,
        usageDate: new Date('2026-09-28'),
        decisionDeadline: new Date('2026-09-24T20:00:00+07:00'),
        user: stubActiveUser,
        facility: stubExclusiveFacility,
        facilityGroup: null,
        processedBy: null,
        items: [],
      },
    ];

    prismaMock.reservation.count.mockResolvedValue(1);
    prismaMock.reservation.findMany.mockResolvedValue(stubItems);

    const result = await service.listStaff({
      status: ReservationStatus.PENDING,
      page: 1,
      limit: 10,
    });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.data[0].id).toBe('res-staff-1');
    expect(prismaMock.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ decisionDeadline: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  });

  it('mengambil antrean reservasi non-PENDING dengan urutan createdAt desc dan filter area/tanggal/search', async () => {
    prismaMock.reservation.count.mockResolvedValue(0);
    prismaMock.reservation.findMany.mockResolvedValue([]);

    await service.listStaff({
      status: ReservationStatus.APPROVED,
      facilityAreaId: 'area-uuid-1',
      usageDate: '2026-09-28',
      search: 'Mahasiswa',
      page: 2,
      limit: 5,
    });

    expect(prismaMock.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReservationStatus.APPROVED,
          usageDate: expect.any(Date),
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                {
                  facility: {
                    facilityGroup: { facilityAreaId: 'area-uuid-1' },
                  },
                },
                { facilityGroup: { facilityAreaId: 'area-uuid-1' } },
              ]),
            }),
          ]),
        }),
        orderBy: [{ usageDate: 'desc' }, { createdAt: 'desc' }],
        skip: 5,
        take: 5,
      }),
    );
  });

  it('mengambil rincian reservasi untuk petugas dan mengembalikan alokasi aset jika APPROVED', async () => {
    const stubApprovedItem = {
      id: 'res-staff-approved',
      userId: stubActiveUser.id,
      facilityId: null,
      facilityGroupId: stubQuantityGroup.id,
      status: ReservationStatus.APPROVED,
      usageDate: new Date('2026-09-28'),
      user: stubActiveUser,
      facility: null,
      facilityGroup: stubQuantityGroup,
      processedBy: {
        id: 'staff-1',
        name: 'Petugas Unispace',
        email: 'staff@kampus.ac.id',
      },
      items: [
        {
          id: 'item-1',
          facility: {
            id: 'unit-1',
            assetCode: 'PRJ-001',
            name: 'Proyektor 01',
          },
        },
      ],
    };

    prismaMock.reservation.findUnique.mockResolvedValue(stubApprovedItem);

    const result = await service.getStaffDetail('res-staff-approved');

    expect(result.id).toBe('res-staff-approved');
    expect(result.allocatedAssets).toHaveLength(1);
    expect(result.allocatedAssets[0].assetCode).toBe('PRJ-001');
  });

  it('melemparkan NotFoundException jika detail reservasi untuk staf tidak ditemukan', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(null);

    await expect(service.getStaffDetail('res-not-found')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ReservationsService - approve', () => {
  let service: ReservationsService;
  const staffId = 'staff-uuid-001';
  const now = new Date('2026-09-24T10:00:00+07:00');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
  });

  it('melemparkan NotFoundException jika reservasi tidak ditemukan', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(null);

    await expect(
      service.approve(staffId, 'non-existent-id', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('melemparkan BadRequestException jika reservasi bukan berstatus PENDING', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-already-approved',
      status: ReservationStatus.APPROVED,
    });

    await expect(
      service.approve(staffId, 'res-already-approved', {}),
    ).rejects.toThrow(BadRequestException);
  });

  describe('Mode Ruang Eksklusif', () => {
    const stubExclusiveRes = {
      id: 'res-exc-1',
      userId: stubActiveUser.id,
      facilityId: stubExclusiveFacility.id,
      facilityGroupId: null,
      requestedQuantity: 1,
      usageDate: new Date('2026-09-28T00:00:00.000Z'),
      startTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
      endTime: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
      purpose: 'Seminar Nasional FSM',
      status: ReservationStatus.PENDING,
      facility: stubExclusiveFacility,
      facilityGroup: null,
    };

    it('melemparkan BadRequestException jika allocatedAssetIds disertakan untuk mode ruang', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubExclusiveRes);

      await expect(
        service.approve(staffId, stubExclusiveRes.id, {
          allocatedAssetIds: ['some-asset-id'],
        }),
      ).rejects.toThrow(
        'Alokasi unit aset fisik (allocatedAssetIds) hanya digunakan untuk kelompok alat (QUANTITY).',
      );
    });

    it('melemparkan BadRequestException jika fasilitas sedang tidak aktif', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue({
        ...stubExclusiveRes,
        facility: {
          ...stubExclusiveFacility,
          status: FacilityStatus.NONACTIVE,
        },
      });

      await expect(
        service.approve(staffId, stubExclusiveRes.id, {}),
      ).rejects.toThrow('Fasilitas sedang tidak aktif.');
    });

    it('melemparkan BadRequestException jika fasilitas sedang dalam masa pemeliharaan', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubExclusiveRes);
      prismaMock.maintenancePeriod.findFirst.mockResolvedValue({
        id: 'maint-1',
        facilityId: stubExclusiveFacility.id,
      });

      await expect(
        service.approve(staffId, stubExclusiveRes.id, {}),
      ).rejects.toThrow(
        'Fasilitas sedang dalam periode pemeliharaan pada jadwal yang dipilih.',
      );
    });

    it('melemparkan BadRequestException jika terdapat reservasi APPROVED lain yang bertumpukan', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubExclusiveRes);
      prismaMock.maintenancePeriod.findFirst.mockResolvedValue(null);
      prismaMock.reservation.findFirst.mockResolvedValue({
        id: 'res-other-approved',
        status: ReservationStatus.APPROVED,
      });

      await expect(
        service.approve(staffId, stubExclusiveRes.id, {}),
      ).rejects.toThrow(
        'Slot fasilitas pada jadwal tersebut sudah disetujui untuk reservasi lain.',
      );
    });

    it('menyetujui reservasi ruang dan melakukan cascade auto-reject pada pengajuan PENDING yang bentrok', async () => {
      prismaMock.reservation.findUnique
        .mockResolvedValueOnce(stubExclusiveRes)
        .mockResolvedValueOnce({
          ...stubExclusiveRes,
          status: ReservationStatus.APPROVED,
          processedBy: { id: staffId, name: 'Petugas Unispace' },
          items: [],
        });
      prismaMock.maintenancePeriod.findFirst.mockResolvedValue(null);
      prismaMock.reservation.findFirst.mockResolvedValue(null);
      prismaMock.reservation.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      // Simulasikan ada 2 permohonan PENDING lain yang bentrok
      prismaMock.reservation.findMany.mockResolvedValue([
        { id: 'res-conflicting-pending-1' },
        { id: 'res-conflicting-pending-2' },
      ]);
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.approve(
        staffId,
        stubExclusiveRes.id,
        {},
        now,
      );

      expect(prismaMock.reservation.update).toHaveBeenCalledWith({
        where: { id: stubExclusiveRes.id },
        data: {
          status: ReservationStatus.APPROVED,
          processedById: staffId,
          decidedAt: now,
        },
      });

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: staffId,
            action: 'RESERVATION_APPROVED',
            entityId: stubExclusiveRes.id,
          }),
        }),
      );

      // Verifikasi cascade auto-reject
      expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['res-conflicting-pending-1', 'res-conflicting-pending-2'],
          },
        },
        data: expect.objectContaining({
          status: ReservationStatus.REJECTED,
          processedById: staffId,
          decidedAt: now,
          decisionReason:
            'Slot fasilitas telah disetujui untuk permohonan reservasi lain.',
        }),
      });

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: staffId,
            action: 'RESERVATION_AUTO_REJECTED',
            entityId: 'res-conflicting-pending-1',
          }),
        }),
      );

      expect(result.status).toBe(ReservationStatus.APPROVED);
      expect(result.allocatedAssets).toHaveLength(1);
      expect(result.allocatedAssets[0].id).toBe(stubExclusiveFacility.id);
    });
  });

  describe('Mode Kelompok Alat (QUANTITY)', () => {
    const stubQuantityRes = {
      id: 'res-qty-1',
      userId: stubActiveUser.id,
      facilityId: null,
      facilityGroupId: stubQuantityGroup.id,
      requestedQuantity: 2,
      usageDate: new Date('2026-09-28T00:00:00.000Z'),
      startTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
      endTime: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
      purpose: 'Peminjaman 2 Proyektor Workshop',
      status: ReservationStatus.PENDING,
      facility: null,
      facilityGroup: stubQuantityGroup,
    };

    it('melemparkan BadRequestException jika allocatedAssetIds tidak disertakan atau kosong', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubQuantityRes);

      await expect(
        service.approve(staffId, stubQuantityRes.id, {}),
      ).rejects.toThrow(
        'Alokasi unit aset fisik (allocatedAssetIds) wajib ditentukan untuk permohonan kelompok alat.',
      );
    });

    it('melemparkan BadRequestException jika jumlah allocatedAssetIds tidak sama dengan requestedQuantity', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubQuantityRes);

      await expect(
        service.approve(staffId, stubQuantityRes.id, {
          allocatedAssetIds: ['unit-1'],
        }),
      ).rejects.toThrow(
        'Jumlah aset yang dialokasikan (1) harus sama dengan kuantitas yang diajukan (2).',
      );
    });

    it('melemparkan BadRequestException jika ada ID aset duplikat dalam daftar alokasi', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubQuantityRes);

      await expect(
        service.approve(staffId, stubQuantityRes.id, {
          allocatedAssetIds: ['unit-1', 'unit-1'],
        }),
      ).rejects.toThrow('Terdapat duplikasi ID aset dalam daftar alokasi.');
    });

    it('melemparkan BadRequestException jika aset yang dialokasikan tidak valid atau bukan milik kelompok', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubQuantityRes);
      prismaMock.facility.findMany.mockResolvedValue([
        { id: 'unit-1', assetCode: 'PRJ-001' },
      ]);

      await expect(
        service.approve(staffId, stubQuantityRes.id, {
          allocatedAssetIds: ['unit-1', 'unit-invalid'],
        }),
      ).rejects.toThrow(
        'Satu atau lebih aset yang dipilih tidak valid, tidak aktif, atau bukan bagian dari kelompok fasilitas ini.',
      );
    });

    it('melemparkan BadRequestException jika aset yang dialokasikan sedang dalam pemeliharaan', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubQuantityRes);
      prismaMock.facility.findMany.mockResolvedValue([
        { id: 'unit-1', assetCode: 'PRJ-001' },
        { id: 'unit-2', assetCode: 'PRJ-002' },
      ]);
      prismaMock.maintenancePeriod.findFirst.mockResolvedValue({
        id: 'maint-unit-1',
        facilityId: 'unit-1',
        facility: { assetCode: 'PRJ-001' },
      });

      await expect(
        service.approve(staffId, stubQuantityRes.id, {
          allocatedAssetIds: ['unit-1', 'unit-2'],
        }),
      ).rejects.toThrow(
        'Aset PRJ-001 sedang dalam masa pemeliharaan pada jadwal tersebut.',
      );
    });

    it('melemparkan BadRequestException jika aset yang dialokasikan sudah dialokasikan pada reservasi APPROVED lain', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(stubQuantityRes);
      prismaMock.facility.findMany.mockResolvedValue([
        { id: 'unit-1', assetCode: 'PRJ-001' },
        { id: 'unit-2', assetCode: 'PRJ-002' },
      ]);
      prismaMock.maintenancePeriod.findFirst.mockResolvedValue(null);
      prismaMock.reservationItem.findFirst.mockResolvedValue({
        id: 'item-conflict',
        facilityId: 'unit-1',
        facility: { assetCode: 'PRJ-001' },
      });

      await expect(
        service.approve(staffId, stubQuantityRes.id, {
          allocatedAssetIds: ['unit-1', 'unit-2'],
        }),
      ).rejects.toThrow(
        'Aset PRJ-001 sudah dialokasikan untuk permohonan reservasi lain pada jadwal yang dipilih.',
      );
    });

    it('menyetujui reservasi alat, mencatat ReservationItem, dan cascade auto-reject pengajuan PENDING yang kekurangan stok', async () => {
      prismaMock.reservation.findUnique
        .mockResolvedValueOnce(stubQuantityRes)
        .mockResolvedValueOnce({
          ...stubQuantityRes,
          status: ReservationStatus.APPROVED,
          processedBy: { id: staffId, name: 'Petugas Unispace' },
          items: [
            {
              id: 'item-1',
              facility: {
                id: 'unit-1',
                assetCode: 'PRJ-001',
                name: 'Proyektor 1',
              },
            },
            {
              id: 'item-2',
              facility: {
                id: 'unit-2',
                assetCode: 'PRJ-002',
                name: 'Proyektor 2',
              },
            },
          ],
        });

      prismaMock.facility.findMany
        .mockResolvedValueOnce([
          { id: 'unit-1', assetCode: 'PRJ-001' },
          { id: 'unit-2', assetCode: 'PRJ-002' },
        ])
        .mockResolvedValueOnce([
          { id: 'unit-1' },
          { id: 'unit-2' },
          { id: 'unit-3' },
        ]);

      prismaMock.maintenancePeriod.findFirst.mockResolvedValue(null);
      prismaMock.reservationItem.findFirst.mockResolvedValue(null);
      prismaMock.reservationItem.createMany.mockResolvedValue({ count: 2 });
      prismaMock.reservation.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const candidatePendingList = [
        {
          id: 'res-pending-surplus',
          requestedQuantity: 1,
          startTime: new Date(Date.UTC(1970, 0, 1, 9, 30, 0)),
          endTime: new Date(Date.UTC(1970, 0, 1, 10, 30, 0)),
        },
        {
          id: 'res-pending-shortage',
          requestedQuantity: 2,
          startTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
          endTime: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
        },
      ];

      prismaMock.reservation.findMany
        .mockResolvedValueOnce(candidatePendingList)
        .mockResolvedValueOnce([
          {
            startTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
            endTime: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
            requestedQuantity: 2,
          },
        ]);

      prismaMock.maintenancePeriod.findMany.mockResolvedValue([]);

      const result = await service.approve(
        staffId,
        stubQuantityRes.id,
        { allocatedAssetIds: ['unit-1', 'unit-2'] },
        now,
      );

      expect(prismaMock.reservationItem.createMany).toHaveBeenCalledWith({
        data: [
          { reservationId: stubQuantityRes.id, facilityId: 'unit-1' },
          { reservationId: stubQuantityRes.id, facilityId: 'unit-2' },
        ],
      });

      expect(prismaMock.reservation.update).toHaveBeenCalledWith({
        where: { id: stubQuantityRes.id },
        data: {
          status: ReservationStatus.APPROVED,
          processedById: staffId,
          decidedAt: now,
        },
      });

      expect(prismaMock.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-pending-shortage' },
        data: expect.objectContaining({
          status: ReservationStatus.REJECTED,
          decisionReason:
            'Ketersediaan unit fasilitas tidak lagi mencukupi untuk memenuhi jumlah yang diajukan.',
        }),
      });

      expect(prismaMock.reservation.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-pending-surplus' },
        }),
      );

      expect(result.status).toBe(ReservationStatus.APPROVED);
      expect(result.allocatedAssets).toHaveLength(2);
      expect(result.allocatedAssets[0].assetCode).toBe('PRJ-001');
      expect(result.allocatedAssets[1].assetCode).toBe('PRJ-002');
    });
  });
});

describe('ReservationsService - reject', () => {
  let service: ReservationsService;
  const staffId = 'staff-uuid-001';
  const now = new Date('2026-09-24T10:00:00+07:00');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
  });

  it('melemparkan NotFoundException jika reservasi tidak ditemukan', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(null);

    await expect(
      service.reject(staffId, 'res-not-found', {
        reason: 'Fasilitas tidak dapat digunakan',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('melemparkan BadRequestException jika reservasi bukan berstatus PENDING', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-already-rejected',
      status: ReservationStatus.APPROVED,
    });

    await expect(
      service.reject(staffId, 'res-already-rejected', {
        reason: 'Fasilitas tidak dapat digunakan',
      }),
    ).rejects.toThrow(
      'Hanya permohonan reservasi berstatus PENDING yang dapat ditolak.',
    );
  });

  it('menolak reservasi PENDING, menyimpan alasan, dan mencatat audit log', async () => {
    const stubPendingRes = {
      id: 'res-reject-1',
      status: ReservationStatus.PENDING,
      facilityId: stubExclusiveFacility.id,
      facility: stubExclusiveFacility,
      facilityGroup: null,
      user: stubActiveUser,
      items: [],
    };

    prismaMock.reservation.findUnique
      .mockResolvedValueOnce(stubPendingRes)
      .mockResolvedValueOnce({
        ...stubPendingRes,
        status: ReservationStatus.REJECTED,
        decisionReason: 'Ruangan sedang dalam persiapan acara wisuda.',
        processedBy: { id: staffId, name: 'Petugas Unispace' },
      });

    prismaMock.reservation.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const result = await service.reject(
      staffId,
      stubPendingRes.id,
      { reason: 'Ruangan sedang dalam persiapan acara wisuda.' },
      now,
    );

    expect(prismaMock.reservation.update).toHaveBeenCalledWith({
      where: { id: stubPendingRes.id },
      data: {
        status: ReservationStatus.REJECTED,
        decisionReason: 'Ruangan sedang dalam persiapan acara wisuda.',
        processedById: staffId,
        decidedAt: now,
      },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: staffId,
        action: 'RESERVATION_REJECTED',
        entityType: 'RESERVATION',
        entityId: stubPendingRes.id,
        metadata: {
          reason: 'Ruangan sedang dalam persiapan acara wisuda.',
          previousStatus: ReservationStatus.PENDING,
        },
      },
    });

    expect(result.status).toBe(ReservationStatus.REJECTED);
    expect(result.decisionReason).toBe(
      'Ruangan sedang dalam persiapan acara wisuda.',
    );
  });
});

describe('ReservationsService - cancelByStaff', () => {
  let service: ReservationsService;
  const staffId = 'staff-uuid-001';
  const now = new Date('2026-09-24T10:00:00+07:00');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
  });

  it('melemparkan NotFoundException jika reservasi tidak ditemukan', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(null);

    await expect(
      service.cancelByStaff(staffId, 'res-not-found', {
        reason: 'Pemeliharaan darurat fasilitas',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('melemparkan BadRequestException jika status reservasi bukan PENDING atau APPROVED', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-already-completed',
      status: ReservationStatus.COMPLETED,
    });

    await expect(
      service.cancelByStaff(staffId, 'res-already-completed', {
        reason: 'Pemeliharaan darurat fasilitas',
      }),
    ).rejects.toThrow(
      'Hanya reservasi berstatus PENDING atau APPROVED yang dapat dibatalkan oleh petugas.',
    );
  });

  it('membatalkan reservasi APPROVED oleh staf, mencatat cancelledAt dan audit log', async () => {
    const stubApprovedRes = {
      id: 'res-cancel-staff-1',
      status: ReservationStatus.APPROVED,
      facilityId: stubExclusiveFacility.id,
      facility: stubExclusiveFacility,
      facilityGroup: null,
      user: stubActiveUser,
      items: [],
    };

    prismaMock.reservation.findUnique
      .mockResolvedValueOnce(stubApprovedRes)
      .mockResolvedValueOnce({
        ...stubApprovedRes,
        status: ReservationStatus.CANCELLED_BY_STAFF,
        decisionReason:
          'Ruangan dialihkan mendadak untuk agenda kunjungan rektorat.',
        processedBy: { id: staffId, name: 'Petugas Unispace' },
        cancelledAt: now,
      });

    prismaMock.reservation.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const result = await service.cancelByStaff(
      staffId,
      stubApprovedRes.id,
      { reason: 'Ruangan dialihkan mendadak untuk agenda kunjungan rektorat.' },
      now,
    );

    expect(prismaMock.reservation.update).toHaveBeenCalledWith({
      where: { id: stubApprovedRes.id },
      data: {
        status: ReservationStatus.CANCELLED_BY_STAFF,
        decisionReason:
          'Ruangan dialihkan mendadak untuk agenda kunjungan rektorat.',
        processedById: staffId,
        cancelledAt: now,
        decidedAt: now,
      },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: staffId,
        action: 'RESERVATION_CANCELLED_BY_STAFF',
        entityType: 'RESERVATION',
        entityId: stubApprovedRes.id,
        metadata: {
          reason: 'Ruangan dialihkan mendadak untuk agenda kunjungan rektorat.',
          previousStatus: ReservationStatus.APPROVED,
        },
      },
    });

    expect(result.status).toBe(ReservationStatus.CANCELLED_BY_STAFF);
    expect(result.decisionReason).toBe(
      'Ruangan dialihkan mendadak untuk agenda kunjungan rektorat.',
    );
  });

  it('membatalkan reservasi PENDING oleh staf dengan alasan valid', async () => {
    const stubPendingRes = {
      id: 'res-cancel-pending',
      status: ReservationStatus.PENDING,
      facilityId: stubExclusiveFacility.id,
      facility: stubExclusiveFacility,
      facilityGroup: null,
      user: stubActiveUser,
      items: [],
    };

    prismaMock.reservation.findUnique
      .mockResolvedValueOnce(stubPendingRes)
      .mockResolvedValueOnce({
        ...stubPendingRes,
        status: ReservationStatus.CANCELLED_BY_STAFF,
        decisionReason:
          'Pemohon meminta pembatalan langsung via pusat bantuan.',
        processedBy: { id: staffId, name: 'Petugas Unispace' },
        cancelledAt: now,
      });

    prismaMock.reservation.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const result = await service.cancelByStaff(
      staffId,
      stubPendingRes.id,
      { reason: 'Pemohon meminta pembatalan langsung via pusat bantuan.' },
      now,
    );

    expect(prismaMock.reservation.update).toHaveBeenCalledWith({
      where: { id: stubPendingRes.id },
      data: {
        status: ReservationStatus.CANCELLED_BY_STAFF,
        decisionReason:
          'Pemohon meminta pembatalan langsung via pusat bantuan.',
        processedById: staffId,
        cancelledAt: now,
        decidedAt: now,
      },
    });

    expect(result.status).toBe(ReservationStatus.CANCELLED_BY_STAFF);
  });
});

describe('ReservationsService - autoRejectExpiredReservations & SLA enforcement', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('mengembalikan 0 jika tidak ada reservasi PENDING yang melewati decisionDeadline', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([]);

    const count = await service.autoRejectExpiredReservations();

    expect(count).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('menolak seluruh reservasi PENDING yang melewati decisionDeadline secara transaksional', async () => {
    const now = new Date('2026-09-24T20:30:00+07:00');
    const expiredRes = [
      {
        id: 'res-expired-1',
        decisionDeadline: new Date('2026-09-24T20:00:00+07:00'),
      },
      {
        id: 'res-expired-2',
        decisionDeadline: new Date('2026-09-24T20:00:00+07:00'),
      },
    ];

    prismaMock.reservation.findMany.mockResolvedValue(expiredRes);
    prismaMock.reservation.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-log-1' });

    const count = await service.autoRejectExpiredReservations(now);

    expect(count).toBe(2);
    expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['res-expired-1', 'res-expired-2'] } },
      data: {
        status: ReservationStatus.REJECTED,
        decidedAt: now,
        decisionReason:
          'Ditolak otomatis oleh sistem karena melewati batas tenggat evaluasi petugas (SLA Expired).',
      },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        action: 'RESERVATION_AUTO_REJECTED',
        entityType: 'RESERVATION',
        entityId: 'res-expired-1',
      }),
    });
  });

  it('approve melemparkan BadRequestException jika reservasi telah melewati decisionDeadline (SLA Expired)', async () => {
    const now = new Date('2026-09-25T10:00:00+07:00');
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-sla-expired',
      status: ReservationStatus.PENDING,
      decisionDeadline: new Date('2026-09-24T20:00:00+07:00'),
      facility: stubExclusiveFacility,
      facilityGroup: null,
    });

    await expect(
      service.approve('staff-uuid', 'res-sla-expired', {}, now),
    ).rejects.toThrow(
      'telah melewati batas tenggat evaluasi petugas (SLA Expired)',
    );
  });
});
