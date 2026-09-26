import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import {
  AccountStatus,
  type User,
  UserRole,
} from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { AdminUsersService } from './admin-users.service';

type ManagedUserRecord = User & {
  verifiedBy: { id: string; name: string; email: string } | null;
};

function user(overrides: Partial<ManagedUserRecord> = {}): ManagedUserRecord {
  return {
    id: 'd0b1cfab-4fbe-4aa6-84da-6864845e9c00',
    name: 'Siti Aminah',
    identityNumber: '12345678',
    email: 'siti@example.test',
    passwordHash: '',
    refreshTokenHash: null,
    role: UserRole.USER,
    accountStatus: AccountStatus.PENDING_VERIFICATION,
    verificationReason: null,
    verifiedById: null,
    verifiedAt: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    verifiedBy: null,
    ...overrides,
  };
}

async function expectError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toMatchObject({ code });
  }
}

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let passwords: PasswordService;
  let records: Map<string, ManagedUserRecord>;
  let database: {
    $transaction: jest.Mock;
    user: {
      count: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    reservation: { findMany: jest.Mock; updateMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(() => {
    records = new Map();
    passwords = new PasswordService();
    database = {
      $transaction: jest.fn(async (callback) => callback(database)),
      user: {
        count: jest.fn(() => Promise.resolve(records.size)),
        create: jest.fn(({ data }) => {
          const created = user({
            id: '00000000-0000-4000-8000-000000000099',
            ...data,
            verificationReason: null,
            verifiedById: null,
            verifiedAt: null,
          });
          records.set(created.id, created);
          return Promise.resolve(created);
        }),
        findMany: jest.fn(() => Promise.resolve([...records.values()])),
        findUnique: jest.fn(({ where }) => {
          if (where.id) {
            return Promise.resolve(records.get(where.id) ?? null);
          }
          return Promise.resolve(
            [...records.values()].find(
              (record) => record.email === where.email,
            ) ?? null,
          );
        }),
        update: jest.fn(({ where, data }) => {
          const target = records.get(where.id);
          if (!target) {
            return Promise.reject(new Error('missing user'));
          }
          Object.assign(target, data, { updatedAt: new Date() });
          return Promise.resolve(target);
        }),
      },
      reservation: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    service = new AdminUsersService(
      database as unknown as PrismaService,
      passwords,
      {
        getOrThrow: jest.fn((key: string) => {
          if (key === 'DEFAULT_USER_PASSWORD') {
            return 'default-password-2026!ab';
          }
          throw new Error(`Unexpected config ${key}`);
        }),
      } as unknown as ConfigService,
    );
  });

  it('lists and returns only safe account fields', async () => {
    const pending = user({
      passwordHash: 'must-not-be-exposed',
      refreshTokenHash: 'must-not-be-exposed',
    });
    records.set(pending.id, pending);

    const result = await service.list({ page: 1, limit: 20 });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: pending.id,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
      }),
    ]);
    expect(result.items[0]).not.toHaveProperty('passwordHash');
    expect(result.items[0]).not.toHaveProperty('refreshTokenHash');
    expect(database.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: [UserRole.USER, UserRole.STAFF] },
        }),
      }),
    );
  });

  it('verifies only a pending account and records the acting admin', async () => {
    const pending = user();
    records.set(pending.id, pending);

    const result = await service.verify('admin-id', pending.id);

    expect(result.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(pending.verifiedById).toBe('admin-id');
    expect(pending.verifiedAt).toBeInstanceOf(Date);
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-id',
        action: 'ACCOUNT_VERIFIED',
        entityId: pending.id,
        metadata: {
          fromStatus: AccountStatus.PENDING_VERIFICATION,
          toStatus: AccountStatus.ACTIVE,
        },
      }),
    });

    await expectError(
      service.verify('admin-id', pending.id),
      'ACCOUNT_STATUS_TRANSITION_INVALID',
    );
  });

  it('rejects a pending account with its mandatory reason and audit metadata', async () => {
    const pending = user();
    records.set(pending.id, pending);

    const result = await service.reject(
      'admin-id',
      pending.id,
      'NIM/NIP tidak sesuai data kampus.',
    );

    expect(result.accountStatus).toBe(AccountStatus.REJECTED);
    expect(result.verification.reason).toBe(
      'NIM/NIP tidak sesuai data kampus.',
    );
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'ACCOUNT_VERIFICATION_REJECTED',
        metadata: expect.objectContaining({
          reason: result.verification.reason,
        }),
      }),
    });
  });

  it('creates only active USER or STAFF accounts with the configured default password', async () => {
    const created = await service.create('admin-id', {
      name: 'Petugas Ruang',
      identityNumber: '87654321',
      email: 'petugas@example.test',
      role: UserRole.STAFF,
    });

    const stored = [...records.values()][0];
    expect(created).toMatchObject({
      role: UserRole.STAFF,
      accountStatus: AccountStatus.ACTIVE,
    });
    expect(
      await passwords.verify('default-password-2026!ab', stored.passwordHash),
    ).toBe(true);
    expect(created).not.toHaveProperty('passwordHash');
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ACCOUNT_CREATED_BY_ADMIN' }),
    });
  });

  it('deactivates an active account, revokes its refresh session, and updates reservations', async () => {
    const active = user({
      accountStatus: AccountStatus.ACTIVE,
      refreshTokenHash: 'refresh-hash',
    });
    records.set(active.id, active);
    database.reservation.findMany
      .mockResolvedValueOnce([
        { id: '00000000-0000-4000-8000-000000000201' },
        { id: '00000000-0000-4000-8000-000000000202' },
      ])
      .mockResolvedValueOnce([{ id: '00000000-0000-4000-8000-000000000203' }]);

    const result = await service.updateStatus(
      'admin-id',
      active.id,
      AccountStatus.NONACTIVE,
    );

    expect(result.accountStatus).toBe(AccountStatus.NONACTIVE);
    expect(active.refreshTokenHash).toBeNull();
    expect(database.reservation.findMany).toHaveBeenCalledTimes(2);
    expect(database.reservation.updateMany).toHaveBeenCalledTimes(3);
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'ACCOUNT_DEACTIVATED',
        metadata: expect.objectContaining({
          pendingReservationsRejected: 2,
          approvedReservationsCancelled: 1,
        }),
      }),
    });
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'RESERVATION_REJECTED',
        entityId: '00000000-0000-4000-8000-000000000201',
      }),
    });
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'RESERVATION_CANCELLED_BY_SYSTEM',
        entityId: '00000000-0000-4000-8000-000000000203',
      }),
    });
  });

  it('reactivates only a nonactive account without restoring reservations', async () => {
    const inactive = user({ accountStatus: AccountStatus.NONACTIVE });
    records.set(inactive.id, inactive);

    const result = await service.updateStatus(
      'admin-id',
      inactive.id,
      AccountStatus.ACTIVE,
    );

    expect(result.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(database.reservation.updateMany).not.toHaveBeenCalled();
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ACCOUNT_ACTIVATED' }),
    });
  });

  it('resets an active or inactive account password without exposing the default password', async () => {
    const active = user({
      accountStatus: AccountStatus.ACTIVE,
      passwordHash: await passwords.hash('old-password-panjang!'),
      refreshTokenHash: 'refresh-hash',
    });
    records.set(active.id, active);

    const result = await service.resetPassword('admin-id', active.id);

    expect(
      await passwords.verify('default-password-2026!ab', active.passwordHash),
    ).toBe(true);
    expect(active.refreshTokenHash).toBeNull();
    expect(result).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('default-password-2026!ab');
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ACCOUNT_PASSWORD_RESET' }),
    });
  });

  it('does not expose or manage ADMIN accounts through user management', async () => {
    const admin = user({ role: UserRole.ADMIN });
    records.set(admin.id, admin);

    await expectError(service.detail(admin.id), 'MANAGED_ACCOUNT_NOT_FOUND');
    await expectError(
      service.resetPassword('admin-id', admin.id),
      'MANAGED_ACCOUNT_NOT_FOUND',
    );
  });
});
