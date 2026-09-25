import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { Readable } from 'node:stream';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  AccountStatus,
  ReservationMode,
  UserRole,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { FacilityImageStorageService } from '../src/facilities/facility-image-storage.service';

const admin = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Admin Unispace',
  identityNumber: '00000001',
  email: 'admin@unispace.test',
  passwordHash: 'not-used-in-this-test',
  refreshTokenHash: null,
  role: UserRole.ADMIN,
  accountStatus: AccountStatus.ACTIVE,
  verificationReason: null,
  verifiedById: null,
  verifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Facilities HTTP integration', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let prisma: Record<string, unknown>;
  const imageStorage = {
    uploadPrimaryImage: jest.fn(),
    getPrimaryImage: jest.fn(),
  };

  beforeEach(async () => {
    const transaction = {
      facilityGroup: {
        create: jest.fn(({ data }) =>
          Promise.resolve({
            id: '20000000-0000-4000-8000-000000000001',
            ...data,
            facilityType: { id: 'type-1', name: 'Aula' },
            facilityArea: {
              id: 'area-1',
              code: 'TEMBALANG',
              name: 'Tembalang',
            },
          }),
        ),
      },
      facility: {
        create: jest.fn(({ data }) =>
          Promise.resolve({
            id: '30000000-0000-4000-8000-000000000001',
            ...data,
          }),
        ),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(admin) },
      facilityType: {
        findUnique: jest.fn().mockResolvedValue({
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Aula',
        }),
      },
      facilityArea: {
        findFirst: jest.fn().mockResolvedValue({
          id: '10000000-0000-4000-8000-000000000002',
          code: 'TEMBALANG',
          name: 'Tembalang',
          status: 'ACTIVE',
        }),
      },
      facility: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    imageStorage.uploadPrimaryImage.mockResolvedValue({
      fileName: '11111111-1111-1111-1111-111111111111.jpg',
      objectKey: 'facility-primary/11111111-1111-1111-1111-111111111111.jpg',
      url: 'http://localhost:3001/api/v1/facilities/images/11111111-1111-1111-1111-111111111111.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 16,
    });
    imageStorage.getPrimaryImage.mockResolvedValue({
      body: Readable.from([Buffer.from('muladi-image')]),
      contentType: 'image/jpeg',
      contentLength: 12,
    });

    const config = {
      get: jest.fn(
        (key: string) =>
          ({ APP_ENV: 'test', FRONTEND_URL: 'http://localhost:3000' })[key],
      ),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          APP_ENV: 'test',
          FRONTEND_URL: 'http://localhost:3000',
          JWT_ACCESS_SECRET: 'access-secret-for-facilities-e2e',
          JWT_REFRESH_SECRET: 'refresh-secret-for-facilities-e2e',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
          S3_ENDPOINT: 'http://localhost:9000',
          S3_REGION: 'us-east-1',
          S3_ACCESS_KEY: 'minioadmin',
          S3_SECRET_KEY: 'minioadmin',
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
      .overrideProvider(FacilityImageStorageService)
      .useValue(imageStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    const jwt = app.get(JwtService);
    accessToken = await jwt.signAsync(
      { sub: admin.id, type: 'access' },
      { secret: 'access-secret-for-facilities-e2e' },
    );
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('mengizinkan ADMIN membuat fasilitas EXCLUSIVE melalui multipart beserta foto', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/facilities/groups')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('name', 'Aula Muladi')
      .field('facilityTypeId', '10000000-0000-4000-8000-000000000001')
      .field('reservationMode', ReservationMode.EXCLUSIVE)
      .field('facilityAreaId', '10000000-0000-4000-8000-000000000002')
      .field('locationDetail', 'Universitas Diponegoro · Tembalang')
      .field('capacity', '300')
      .field('assetCode', 'UNDIP-AULA-MULADI-01')
      .attach('primaryImage', Buffer.from('muladi-photo-bytes'), {
        filename: 'Aulamuladi.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      statusCode: 201,
      data: {
        name: 'Aula Muladi',
        primaryImageUrl:
          'http://localhost:3001/api/v1/facilities/images/11111111-1111-1111-1111-111111111111.jpg',
        initialUnit: {
          assetCode: 'UNDIP-AULA-MULADI-01',
          capacity: 300,
        },
      },
    });
    expect(imageStorage.uploadPrimaryImage).toHaveBeenCalledWith(
      expect.objectContaining({
        originalname: 'Aulamuladi.jpg',
        mimetype: 'image/jpeg',
      }),
    );
  });

  it('menolak endpoint admin tanpa access token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/facilities/groups')
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
      });
  });

  it('menolak nama area yang belum mencapai dua karakter', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/facilities/areas')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'FT', name: 'A' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(body.error.details).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
        );
      });
  });

  it('mengembalikan error API standar saat foto melebihi batas 5 MB', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/facilities/groups')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('primaryImage', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'oversized.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: false,
          error: {
            code: 'FACILITY_IMAGE_TOO_LARGE',
          },
        });
      });
  });

  it('menyajikan foto fasilitas dari endpoint publik tanpa token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/facilities/images/11111111-1111-1111-1111-111111111111.jpg')
      .expect('Content-Type', /image\/jpeg/)
      .expect(200);

    expect(response.headers['cache-control']).toBe('public, max-age=86400');
    expect(imageStorage.getPrimaryImage).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111.jpg',
    );
  });
});
