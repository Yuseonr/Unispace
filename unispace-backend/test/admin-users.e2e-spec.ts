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
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  verifiedBy: { id: string; name: string; email: string } | null;
};

type ReservationRecord = {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED_BY_SYSTEM';
  usageDate: Date;
  endTime: Date;
  decisionReason: string | null;
  decidedAt: Date | null;
  cancelledAt: Date | null;
  processedById: string | null;
};

function futureDate() {
  return new Date('2099-10-20T00:00:00.000Z');
}

describe('Admin user management HTTP integration', () => {
  let app: INestApplication<App>;
  let users: Map<string, UserRecord>;
  let reservations: Map<string, ReservationRecord>;
  let auditEvents: Array<Record<string, unknown>>;
  let passwords: PasswordService;
  let nextId: number;

  beforeEach(async () => {
    users = new Map();
    reservations = new Map();
    auditEvents = [];
    passwords = new PasswordService();
    nextId = 1;

    const findUser = (where: { id?: string; email?: string }) =>
      [...users.values()].find(
        (user) =>
          (where.id === undefined || user.id === where.id) &&
          (where.email === undefined || user.email === where.email),
      ) ?? null;
    const matchUserWhere = (
      user: UserRecord,
      where: Record<string, unknown>,
    ) => {
      const role = where.role;
      if (typeof role === 'string' && user.role !== role) {
        return false;
      }
      if (
        typeof role === 'object' &&
        role !== null &&
        'in' in role &&
        Array.isArray(role.in) &&
        !role.in.includes(user.role)
      ) {
        return false;
      }
      if (
        typeof where.accountStatus === 'string' &&
        user.accountStatus !== where.accountStatus
      ) {
        return false;
      }
      const conditions = where.OR;
      if (!Array.isArray(conditions)) {
        return true;
      }
      return conditions.some((condition) => {
        if (typeof condition !== 'object' || condition === null) {
          return false;
        }
        const candidate = condition as Record<string, Record<string, string>>;
        return (
          (candidate.name?.contains !== undefined &&
            user.name
              .toLowerCase()
              .includes(candidate.name.contains.toLowerCase())) ||
          (candidate.email?.contains !== undefined &&
            user.email
              .toLowerCase()
              .includes(candidate.email.contains.toLowerCase())) ||
          (candidate.identityNumber?.contains !== undefined &&
            user.identityNumber.includes(candidate.identityNumber.contains))
        );
      });
    };

    const prisma = {
      $transaction: jest.fn(async (callback) => callback(prisma)),
      user: {
        findUnique: jest.fn(({ where }) => Promise.resolve(findUser(where))),
        findMany: jest.fn(({ where, skip, take }) => {
          const matched = [...users.values()].filter((user) =>
            matchUserWhere(user, where),
          );
          return Promise.resolve(matched.slice(skip, skip + take));
        }),
        count: jest.fn(({ where }) =>
          Promise.resolve(
            [...users.values()].filter((user) => matchUserWhere(user, where))
              .length,
          ),
        ),
        create: jest.fn(({ data }) => {
          if (
            findUser({ email: data.email }) ||
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
            refreshTokenHash: data.refreshTokenHash ?? null,
            verificationReason: data.verificationReason ?? null,
            verifiedById: data.verifiedById ?? null,
            verifiedAt: data.verifiedAt ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            verifiedBy: null,
          };
          users.set(record.id, record);
          return Promise.resolve(record);
        }),
        update: jest.fn(({ where, data }) => {
          const target = findUser(where);
          if (!target) {
            return Promise.reject(new Error('missing user'));
          }
          Object.assign(target, data, { updatedAt: new Date() });
          if (data.verifiedById) {
            const verifier = findUser({ id: data.verifiedById });
            target.verifiedBy = verifier
              ? { id: verifier.id, name: verifier.name, email: verifier.email }
              : null;
          }
          return Promise.resolve(target);
        }),
        updateMany: jest.fn(({ where, data }) => {
          const target = findUser(where);
          if (
            !target ||
            (where.refreshTokenHash !== undefined &&
              target.refreshTokenHash !== where.refreshTokenHash)
          ) {
            return Promise.resolve({ count: 0 });
          }
          Object.assign(target, data, { updatedAt: new Date() });
          return Promise.resolve({ count: 1 });
        }),
      },
      reservation: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(
            [...reservations.values()]
              .filter((reservation) => {
                if (where.userId && reservation.userId !== where.userId) {
                  return false;
                }
                if (where.status && reservation.status !== where.status) {
                  return false;
                }
                if (!where.OR) {
                  return true;
                }
                return where.OR.some(
                  (condition: {
                    usageDate?: { gt?: Date } | Date;
                    endTime?: { gte: Date };
                  }) => {
                    if (
                      condition.usageDate &&
                      typeof condition.usageDate === 'object' &&
                      'gt' in condition.usageDate
                    ) {
                      return reservation.usageDate > condition.usageDate.gt!;
                    }
                    return (
                      reservation.usageDate.getTime() ===
                        (condition.usageDate as Date).getTime() &&
                      reservation.endTime >= condition.endTime!.gte
                    );
                  },
                );
              })
              .map(({ id }) => ({ id })),
          ),
        ),
        updateMany: jest.fn(({ where, data }) => {
          const updated = [...reservations.values()].filter((reservation) => {
            if (where.id && reservation.id !== where.id) {
              return false;
            }
            if (where.userId && reservation.userId !== where.userId) {
              return false;
            }
            if (where.status && reservation.status !== where.status) {
              return false;
            }
            if (!where.OR) {
              return true;
            }
            return where.OR.some(
              (condition: {
                usageDate?: { gt?: Date } | Date;
                endTime?: { gte: Date };
              }) => {
                if (
                  condition.usageDate &&
                  typeof condition.usageDate === 'object' &&
                  'gt' in condition.usageDate
                ) {
                  return reservation.usageDate > condition.usageDate.gt!;
                }
                return (
                  reservation.usageDate.getTime() ===
                    (condition.usageDate as Date).getTime() &&
                  reservation.endTime >= condition.endTime!.gte
                );
              },
            );
          });
          updated.forEach((reservation) => Object.assign(reservation, data));
          return Promise.resolve({ count: updated.length });
        }),
      },
      auditLog: {
        create: jest.fn(({ data }) => {
          auditEvents.push(data);
          return Promise.resolve(data);
        }),
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
          DEFAULT_USER_PASSWORD: 'default-password-2026!ab',
          JWT_ACCESS_SECRET: 'access-secret-for-e2e-tests',
          JWT_REFRESH_SECRET: 'refresh-secret-for-e2e-tests',
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
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function addUser(
    role: UserRole,
    accountStatus: AccountStatus,
    overrides: Partial<UserRecord> = {},
  ) {
    const record: UserRecord = {
      id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
      name: 'Account Test',
      identityNumber: String(12_345_678 + nextId),
      email: `account-${nextId}@example.test`,
      passwordHash: await passwords.hash('password-yang-panjang'),
      refreshTokenHash: null,
      role,
      accountStatus,
      verificationReason: null,
      verifiedById: null,
      verifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      verifiedBy: null,
      ...overrides,
    };
    users.set(record.id, record);
    return record;
  }

  async function accessTokenFor(user: UserRecord) {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password-yang-panjang' })
      .expect(201);
    return login.body.data.accessToken as string;
  }

  it('allows only ADMIN to list safe USER and STAFF account data', async () => {
    const admin = await addUser(UserRole.ADMIN, AccountStatus.ACTIVE);
    const regularUser = await addUser(UserRole.USER, AccountStatus.ACTIVE);
    const staff = await addUser(UserRole.STAFF, AccountStatus.NONACTIVE);
    const userToken = await accessTokenFor(regularUser);

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('ROLE_FORBIDDEN');
      });

    const adminToken = await accessTokenFor(admin);
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .query({ role: UserRole.STAFF, status: AccountStatus.NONACTIVE })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({ total: 1, page: 1, limit: 20 });
        expect(body.data.items).toEqual([
          expect.objectContaining({ id: staff.id, role: UserRole.STAFF }),
        ]);
        expect(body.data.items[0]).not.toHaveProperty('passwordHash');
        expect(body.data.items[0]).not.toHaveProperty('refreshTokenHash');
      });
  });

  it('verifies or rejects pending registration with an audit trail', async () => {
    const admin = await addUser(UserRole.ADMIN, AccountStatus.ACTIVE);
    const pending = await addUser(
      UserRole.USER,
      AccountStatus.PENDING_VERIFICATION,
    );
    const rejected = await addUser(
      UserRole.USER,
      AccountStatus.PENDING_VERIFICATION,
    );
    const adminToken = await accessTokenFor(admin);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${pending.id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          id: pending.id,
          accountStatus: AccountStatus.ACTIVE,
          verification: expect.objectContaining({
            verifiedBy: expect.objectContaining({ id: admin.id }),
          }),
        });
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${rejected.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${rejected.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Data NIM/NIP tidak sesuai.' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          id: rejected.id,
          accountStatus: AccountStatus.REJECTED,
          verification: { reason: 'Data NIM/NIP tidak sesuai.' },
        });
      });

    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: admin.id,
          action: 'ACCOUNT_VERIFIED',
          entityId: pending.id,
        }),
        expect.objectContaining({
          actorId: admin.id,
          action: 'ACCOUNT_VERIFICATION_REJECTED',
          entityId: rejected.id,
        }),
      ]),
    );
  });

  it('creates only active USER or STAFF accounts with a hidden configured password', async () => {
    const admin = await addUser(UserRole.ADMIN, AccountStatus.ACTIVE);
    const adminToken = await accessTokenFor(admin);

    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '  Petugas   Ruang ',
        identityNumber: '87654321',
        email: ' PETUGAS@EXAMPLE.TEST ',
        role: UserRole.STAFF,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          name: 'Petugas Ruang',
          email: 'petugas@example.test',
          role: UserRole.STAFF,
          accountStatus: AccountStatus.ACTIVE,
        });
        expect(body.data).not.toHaveProperty('passwordHash');
        expect(body.data).not.toHaveProperty('refreshTokenHash');
      });

    const created = [...users.values()].find(
      (user) => user.email === 'petugas@example.test',
    );
    expect(created).toBeDefined();
    expect(
      await passwords.verify('default-password-2026!ab', created!.passwordHash),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Tidak Boleh Dibuat',
        identityNumber: '76543210',
        email: 'forbidden-admin@example.test',
        role: UserRole.ADMIN,
      })
      .expect(400);
  });

  it('deactivates, reactivates, and resets managed accounts without restoring reservations', async () => {
    const admin = await addUser(UserRole.ADMIN, AccountStatus.ACTIVE);
    const target = await addUser(UserRole.USER, AccountStatus.ACTIVE, {
      refreshTokenHash: 'existing-refresh-hash',
    });
    const pendingReservation: ReservationRecord = {
      id: '10000000-0000-4000-8000-000000000001',
      userId: target.id,
      status: 'PENDING',
      usageDate: futureDate(),
      endTime: new Date('1970-01-01T15:00:00.000Z'),
      decisionReason: null,
      decidedAt: null,
      cancelledAt: null,
      processedById: null,
    };
    const approvedReservation: ReservationRecord = {
      ...pendingReservation,
      id: '10000000-0000-4000-8000-000000000002',
      status: 'APPROVED',
    };
    reservations.set(pendingReservation.id, pendingReservation);
    reservations.set(approvedReservation.id, approvedReservation);
    const adminToken = await accessTokenFor(admin);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: AccountStatus.NONACTIVE })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.accountStatus).toBe(AccountStatus.NONACTIVE);
      });

    expect(target.refreshTokenHash).toBeNull();
    expect(pendingReservation.status).toBe('REJECTED');
    expect(approvedReservation.status).toBe('CANCELLED_BY_SYSTEM');

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: AccountStatus.ACTIVE })
      .expect(200);

    expect(pendingReservation.status).toBe('REJECTED');
    expect(approvedReservation.status).toBe('CANCELLED_BY_SYSTEM');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201)
      .expect(({ body }) => {
        expect(body.data).not.toHaveProperty('passwordHash');
        expect(body.data).not.toHaveProperty('refreshTokenHash');
      });

    expect(
      await passwords.verify('default-password-2026!ab', target.passwordHash),
    ).toBe(true);
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'ACCOUNT_DEACTIVATED' }),
        expect.objectContaining({ action: 'ACCOUNT_ACTIVATED' }),
        expect.objectContaining({ action: 'ACCOUNT_PASSWORD_RESET' }),
      ]),
    );
  });
});
