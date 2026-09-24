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
  reservation: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
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
