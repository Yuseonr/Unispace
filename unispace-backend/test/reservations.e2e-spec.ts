import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  AccountStatus,
  FacilityStatus,
  ReservationMode,
  ReservationStatus,
  UserRole,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/database/prisma.service';

const testUser = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Mahasiswa Unispace',
  identityNumber: '24060120120001',
  email: 'mahasiswa@unispace.test',
  passwordHash: 'not-used',
  refreshTokenHash: null,
  role: UserRole.USER,
  accountStatus: AccountStatus.ACTIVE,
  verificationReason: null,
  verifiedById: null,
  verifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testStaff = {
  id: '20000000-0000-4000-8000-000000000002',
  name: 'Petugas Unispace',
  identityNumber: '198001012005011001',
  email: 'staff@unispace.test',
  passwordHash: 'not-used',
  refreshTokenHash: null,
  role: UserRole.STAFF,
  accountStatus: AccountStatus.ACTIVE,
  verificationReason: null,
  verifiedById: null,
  verifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const stubExclusiveFacility = {
  id: '30000000-0000-4000-8000-000000000001',
  facilityGroupId: '40000000-0000-4000-8000-000000000001',
  assetCode: 'LAB-01',
  name: 'Lab Komputer 1',
  status: FacilityStatus.ACTIVE,
  capacity: 40,
  description: 'Lab Praktikum',
  primaryImageUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  facilityGroup: {
    id: '40000000-0000-4000-8000-000000000001',
    name: 'Lab Komputer',
    reservationMode: ReservationMode.EXCLUSIVE,
    locationDetail: 'Gedung E Lantai 2',
    facilityArea: {
      id: '50000000-0000-4000-8000-000000000001',
      code: 'FSM',
      name: 'Fakultas Sains dan Matematika',
    },
    facilityType: {
      id: '60000000-0000-4000-8000-000000000001',
      name: 'Laboratorium',
    },
  },
};

function getValidFutureOperationalDate(): string {

  const date = new Date();
  let count = 0;
  while (count < 4) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

const validFutureOperationalDate = getValidFutureOperationalDate();

describe('Reservations HTTP Integration (E2E)', () => {
  let app: INestApplication<App>;

  let userToken: string;
  let staffToken: string;
  let prisma: Record<string, unknown>;

  const jwtSecret = 'access-secret-for-reservations-e2e';

  beforeEach(async () => {
    const transaction = {
      facility: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) => {
          if (where.id === stubExclusiveFacility.id) {
            return Promise.resolve(stubExclusiveFacility);
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      reservation: {
        create: jest.fn(({ data }) =>
          Promise.resolve({
            id: '70000000-0000-4000-8000-000000000001',
            ...data,
            facility: stubExclusiveFacility,
            facilityGroup: null,
          }),
        ),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      reservationItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      maintenancePeriod: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };


    prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { id?: string } }) => {
          if (where.id === testUser.id) {
            return Promise.resolve(testUser);
          }
          if (where.id === testStaff.id) {
            return Promise.resolve(testStaff);
          }
          return Promise.resolve(null);
        }),
      },
      facility: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) => {
          if (where.id === stubExclusiveFacility.id) {
            return Promise.resolve(stubExclusiveFacility);
          }
          return Promise.resolve(null);
        }),
      },
      facilityGroup: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      reservation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve({
            id: where.id,
            userId: testUser.id,
            facilityId: stubExclusiveFacility.id,
            facilityGroupId: null,
            requestedQuantity: 1,
            usageDate: new Date('2026-09-28'),
            startTime: new Date('1970-01-01T08:00:00Z'),
            endTime: new Date('1970-01-01T10:00:00Z'),
            purpose: 'Praktikum Pemrograman Web',
            status: ReservationStatus.PENDING,
            decisionDeadline: new Date('2026-09-24T20:00:00+07:00'),
            user: testUser,
            facility: stubExclusiveFacility,
            facilityGroup: null,
            processedBy: null,
            items: [],
          }),
        ),
        findMany: jest.fn().mockResolvedValue([
          {
            id: '70000000-0000-4000-8000-000000000001',
            userId: testUser.id,
            facilityId: stubExclusiveFacility.id,
            facilityGroupId: null,
            requestedQuantity: 1,
            usageDate: new Date('2026-09-28'),
            startTime: new Date('1970-01-01T08:00:00Z'),
            endTime: new Date('1970-01-01T10:00:00Z'),
            purpose: 'Praktikum Pemrograman Web',
            status: ReservationStatus.PENDING,
            decisionDeadline: new Date('2026-09-24T20:00:00+07:00'),
            user: testUser,
            facility: stubExclusiveFacility,
            facilityGroup: null,
            processedBy: null,
            items: [],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      maintenancePeriod: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };

    const config = {
      get: jest.fn(
        (key: string) =>
          ({ APP_ENV: 'test', FRONTEND_URL: 'http://localhost:3000' })[key],
      ),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          APP_ENV: 'test',
          FRONTEND_URL: 'http://localhost:3000',
          JWT_ACCESS_SECRET: jwtSecret,
          JWT_REFRESH_SECRET: 'refresh-secret-for-reservations-e2e',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        if (!values[key]) {
          throw new Error(`Missing test config ${key}`);
        }
        return values[key];
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const jwt = app.get(JwtService);
    userToken = await jwt.signAsync(
      { sub: testUser.id, type: 'access' },
      { secret: jwtSecret },
    );
    staffToken = await jwt.signAsync(
      { sub: testStaff.id, type: 'access' },
      { secret: jwtSecret },
    );
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  // -------------------------------------------------------------------------
  // 1. Availability Endpoints (Public)
  // -------------------------------------------------------------------------
  describe('GET /api/v1/reservations/availability (Public)', () => {
    it('mengizinkan akses publik tanpa token untuk mengecek 26 slot ketersediaan', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reservations/availability')
        .query({
          facilityId: stubExclusiveFacility.id,
          usageDate: '2026-09-28',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('slots');
      expect(Array.isArray(response.body.data.slots)).toBe(true);
      expect(response.body.data.slots).toHaveLength(26);
    });

    it('menolak jika parameter facilityId atau usageDate tidak disertakan', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/reservations/availability',
      );

      expect(response.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 2. User Reservations Endpoints (/reservations)
  // -------------------------------------------------------------------------
  describe('User Endpoints (/api/v1/reservations)', () => {
    it('menolak pengajuan reservasi jika unauthenticated (401 Unauthorized)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .send({
          facilityId: stubExclusiveFacility.id,
          usageDate: '2026-09-28',
          startTime: '08:00',
          endTime: '10:00',
          purpose: 'Kegiatan praktikum mahasiswa',
        });

      expect(response.status).toBe(401);
    });

    it('menolak pengajuan reservasi jika dilakukan oleh role STAFF (403 Forbidden)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          facilityId: stubExclusiveFacility.id,
          usageDate: '2026-09-28',
          startTime: '08:00',
          endTime: '10:00',
          purpose: 'Kegiatan praktikum mahasiswa',
        });

      expect(response.status).toBe(403);
    });

    it('mengizinkan USER mengajukan permohonan reservasi dengan payload valid (201 Created)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          facilityId: stubExclusiveFacility.id,
          usageDate: validFutureOperationalDate,
          startTime: '08:00',
          endTime: '10:00',
          purpose: 'Kegiatan praktikum mahasiswa semester 5',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('mengizinkan USER mengambil riwayat permohonan reservasi miliknya (GET /my)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reservations/my')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('meta');
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('menolak role STAFF saat mengakses riwayat pengguna (GET /my -> 403 Forbidden)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reservations/my')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Staff Reservations Endpoints (/staff/reservations)
  // -------------------------------------------------------------------------
  describe('Staff Endpoints (/api/v1/staff/reservations)', () => {
    it('menolak akses ke antrean staff jika unauthenticated (401 Unauthorized)', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/staff/reservations',
      );

      expect(response.status).toBe(401);
    });

    it('menolak akses role USER ke antrean staff (403 Forbidden)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/staff/reservations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('mengizinkan role STAFF mengambil antrean reservasi (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/staff/reservations')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ status: 'PENDING', page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('meta');
      expect(response.body.data.meta.total).toBe(1);
      expect(response.body.data.data[0].id).toBe(
        '70000000-0000-4000-8000-000000000001',
      );
    });

    it('mengizinkan role STAFF melihat rincian lengkap satu permohonan reservasi (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/api/v1/staff/reservations/70000000-0000-4000-8000-000000000001',
        )
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.purpose).toBe('Praktikum Pemrograman Web');
    });

    it('menolak akses ke detail staf jika ID bukan format UUID valid (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/staff/reservations/invalid-uuid-id')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(400);
    });

    it('menolak persetujuan reservasi jika unauthenticated (401 Unauthorized)', async () => {
      const response = await request(app.getHttpServer()).patch(
        '/api/v1/staff/reservations/70000000-0000-4000-8000-000000000001/approve',
      );

      expect(response.status).toBe(401);
    });

    it('menolak persetujuan reservasi jika diakses role USER (403 Forbidden)', async () => {
      const response = await request(app.getHttpServer())
        .patch(
          '/api/v1/staff/reservations/70000000-0000-4000-8000-000000000001/approve',
        )
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(403);
    });

    it('menolak persetujuan reservasi jika ID bukan UUID valid (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/staff/reservations/not-a-uuid/approve')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('mengizinkan role STAFF menyetujui reservasi ruang eksklusif secara atomik (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .patch(
          '/api/v1/staff/reservations/70000000-0000-4000-8000-000000000001/approve',
        )
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.id).toBe(
        '70000000-0000-4000-8000-000000000001',
      );
    });

    it('menolak aksi reject jika alasan tidak disertakan atau kurang dari 5 karakter (400 Bad Request)', async () => {
      const response = await request(app.getHttpServer())
        .patch(
          '/api/v1/staff/reservations/70000000-0000-4000-8000-000000000001/reject',
        )
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'abc' });

      expect(response.status).toBe(400);
    });

    it('mengizinkan role STAFF menolak permohonan reservasi PENDING dengan alasan valid (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .patch(
          '/api/v1/staff/reservations/70000000-0000-4000-8000-000000000001/reject',
        )
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Fasilitas sedang dipersiapkan untuk kegiatan dinas kampus.' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
    });

    it('menolak aksi cancel jika alasan pembatalan tidak disertakan atau kurang dari 5 karakter (400 Bad Request)', async () => {
      const failResponse = await request(app.getHttpServer())
        .patch(
          '/api/v1/staff/reservations/70000000-0000-4000-8000-000000000001/cancel',
        )
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: '123' });

      expect(failResponse.status).toBe(400);
    });


    it('mengizinkan role STAFF membatalkan reservasi aktif dengan alasan valid (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .patch(
          '/api/v1/staff/reservations/70000000-0000-4000-8000-000000000001/cancel',
        )
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Agenda darurat institusi membutuhkan ruangan ini.' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
    });
  });
});


