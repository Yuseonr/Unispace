import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AccountStatus, UserRole } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/accounts/auth/password.service';
import { PrismaService } from '../src/database/prisma.service';

type UserRecord = {
  id: string;
  name: string;
  identityNumber: string;
  email: string;
  passwordHash: string;
  refreshTokenHash: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  verificationReason: string | null;
  verifiedById: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
  updatedAt: Date;
};

type UserWhere = {
  email?: string;
  id?: string;
  refreshTokenHash?: string | null;
};

describe('Authentication HTTP integration', () => {
  let app: INestApplication<App>;
  let users: Map<string, UserRecord>;
  let passwords: PasswordService;

  beforeEach(async () => {
    users = new Map();
    passwords = new PasswordService();
    let nextId = 1;
    const findOne = (where: UserWhere) =>
      [...users.values()].find(
        (user) =>
          (where.id === undefined || user.id === where.id) &&
          (where.email === undefined || user.email === where.email),
      ) ?? null;

    const prisma = {
      user: {
        findUnique: jest.fn(({ where }) => Promise.resolve(findOne(where))),
        create: jest.fn(({ data }) => {
          if (
            findOne({ email: data.email }) ||
            [...users.values()].some(
              (user) => user.identityNumber === data.identityNumber,
            )
          ) {
            return Promise.reject(
              Object.assign(new Error('duplicate'), { code: 'P2002' }),
            );
          }
          const record: UserRecord = {
            id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
            ...data,
            role: UserRole.USER,
            accountStatus: AccountStatus.PENDING_VERIFICATION,
            verificationReason: null,
            verifiedById: null,
            createdAt: new Date(),
            verifiedAt: null,
            updatedAt: new Date(),
          };
          users.set(record.id, record);
          return Promise.resolve(record);
        }),
        update: jest.fn(({ where, data }) => {
          const user = findOne(where);
          if (!user) {
            return Promise.reject(new Error('missing user'));
          }
          Object.assign(user, data);
          return Promise.resolve(user);
        }),
        updateMany: jest.fn(({ where, data }) => {
          const user = findOne(where);
          if (
            !user ||
            (where.refreshTokenHash !== undefined &&
              user.refreshTokenHash !== where.refreshTokenHash)
          ) {
            return Promise.resolve({ count: 0 });
          }
          Object.assign(user, data);
          return Promise.resolve({ count: 1 });
        }),
      },
      auditLog: {
        create: jest.fn(({ data }) => Promise.resolve(data)),
      },
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
          JWT_ACCESS_SECRET: 'access-secret-for-e2e-tests',
          JWT_REFRESH_SECRET: 'refresh-secret-for-e2e-tests',
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
  });

  afterEach(async () => {
    await app.close();
  });

  async function addActiveUser(role = UserRole.USER) {
    const user: UserRecord = {
      id: `00000000-0000-4000-8000-${String(users.size + 100).padStart(12, '0')}`,
      name: 'Active User',
      identityNumber: String(12345678 + users.size),
      email: `active-${users.size}@example.test`,
      passwordHash: await passwords.hash('password-yang-panjang'),
      refreshTokenHash: null,
      role,
      accountStatus: AccountStatus.ACTIVE,
      verificationReason: null,
      verifiedById: null,
      createdAt: new Date(),
      verifiedAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(user.id, user);
    return user;
  }

  it('validates, normalizes, and creates a pending USER without exposing secrets', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: '  Siti   Aminah ',
        identityNumber: '12345678',
        email: ' SITI@EXAMPLE.TEST ',
        password: 'password-yang-panjang',
      })
      .expect(201);

    expect(registration.body).toMatchObject({
      success: true,
      statusCode: 201,
      data: {
        name: 'Siti Aminah',
        email: 'siti@example.test',
        role: UserRole.USER,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
      },
    });
    expect(registration.body.requestId).toBe(
      registration.headers['x-request-id'],
    );
    expect(registration.body.data).not.toHaveProperty('passwordHash');
    expect(registration.body.data).not.toHaveProperty('refreshTokenHash');

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Siti Aminah',
        identityNumber: '12345678',
        email: 'siti@example.test',
        password: 'password-yang-panjang',
        role: 'ADMIN',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.success).toBe(false);
        expect(body.statusCode).toBe(400);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: '1',
        identityNumber: 'NIM-INVALID',
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(
          body.error.details.map((detail: { field: string }) => detail.field),
        ).toEqual(
          expect.arrayContaining([
            'name',
            'identityNumber',
            'email',
            'password',
          ]),
        );
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Whitespace Password',
        identityNumber: '87654321',
        email: 'whitespace-password@example.test',
        password: '            ',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ]),
        );
      });
  });

  it('returns a clear pending status and keeps rejected identities unavailable for re-registration', async () => {
    const pending = await addActiveUser();
    pending.accountStatus = AccountStatus.PENDING_VERIFICATION;

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: pending.email, password: 'password-yang-panjang' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('ACCOUNT_PENDING_VERIFICATION');
      });

    pending.accountStatus = AccountStatus.REJECTED;
    pending.verificationReason = 'Data NIM/NIP tidak cocok.';
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: pending.email, password: 'password-yang-panjang' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('ACCOUNT_REJECTED');
        expect(body.error.details.reason).toBe('Data NIM/NIP tidak cocok.');
      });

    for (const status of [AccountStatus.REJECTED, AccountStatus.NONACTIVE]) {
      pending.accountStatus = status;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Another User',
          identityNumber: pending.identityNumber,
          email: pending.email,
          password: 'password-yang-panjang',
        })
        .expect(409)
        .expect(({ body }) => {
          expect(body.error.code).toBe('ACCOUNT_ALREADY_EXISTS');
        });
    }
  });

  it('uses an HttpOnly refresh cookie for login, refresh, logout, and private profile access', async () => {
    const user = await addActiveUser();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password-yang-panjang' })
      .expect(201);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const accessToken = login.body.data.accessToken;

    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(login.body.data).not.toHaveProperty('refreshToken');

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({ id: user.id, email: user.email });
        expect(body.data).not.toHaveProperty('passwordHash');
      });

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(201);
    expect(refreshed.body.data.accessToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshed.headers['set-cookie'][0].split(';')[0])
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshed.headers['set-cookie'][0].split(';')[0])
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe('REFRESH_TOKEN_REVOKED');
      });
  });

  it('checks account status on every private request and lets STAFF change its own password', async () => {
    const staff = await addActiveUser(UserRole.STAFF);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staff.email, password: 'password-yang-panjang' })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({
        currentPassword: 'password-yang-panjang',
        newPassword: '            ',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'newPassword' }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({
        currentPassword: 'password-yang-panjang',
        newPassword: 'password-baru-yang-panjang',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.accessToken).toBeTruthy();
        expect(body.data.user.role).toBe(UserRole.STAFF);
      });

    staff.accountStatus = AccountStatus.NONACTIVE;
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('ACCOUNT_NONACTIVE');
      });
  });
});
