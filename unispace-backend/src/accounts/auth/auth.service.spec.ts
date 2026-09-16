import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { jest } from '@jest/globals';
import {
  AccountStatus,
  type User,
  UserRole,
} from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

const configValues = {
  JWT_ACCESS_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'd0b1cfab-4fbe-4aa6-84da-6864845e9c00',
    name: 'Siti Aminah',
    identityNumber: '12345678',
    email: 'siti@example.test',
    passwordHash: '',
    refreshTokenHash: null,
    role: UserRole.USER,
    accountStatus: AccountStatus.ACTIVE,
    verificationReason: null,
    verifiedById: null,
    createdAt: new Date(),
    verifiedAt: new Date(),
    updatedAt: new Date(),
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

describe('AuthService', () => {
  let service: AuthService;
  let passwords: PasswordService;
  let database: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: { create: jest.Mock };
  };

  beforeEach(() => {
    database = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    passwords = new PasswordService();
    service = new AuthService(
      database as unknown as PrismaService,
      passwords,
      new JwtService(),
      {
        getOrThrow: jest.fn(
          (key: keyof typeof configValues) => configValues[key],
        ),
      } as unknown as ConfigService,
    );
  });

  it('creates only a pending USER for self-registration', async () => {
    const created = user({
      accountStatus: AccountStatus.PENDING_VERIFICATION,
    });
    database.user.create.mockResolvedValue(created);

    const result = await service.register({
      name: 'Siti Aminah',
      identityNumber: '12345678',
      email: 'siti@example.test',
      password: 'password-yang-panjang',
    });

    expect(database.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Siti Aminah',
        identityNumber: '12345678',
        email: 'siti@example.test',
        passwordHash: expect.stringMatching(/^\$2[aby]\$\d{2}\$/),
      }),
    });
    expect(result).toMatchObject({
      role: UserRole.USER,
      accountStatus: AccountStatus.PENDING_VERIFICATION,
    });
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: created.id,
        action: 'USER_REGISTERED',
        entityType: 'USER',
        entityId: created.id,
      },
    });
  });

  it('does not allow re-registration of rejected or inactive identities', async () => {
    database.user.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: 'P2002' }),
    );

    await expectError(
      service.register({
        name: 'Siti Aminah',
        identityNumber: '12345678',
        email: 'siti@example.test',
        password: 'password-yang-panjang',
      }),
      'ACCOUNT_ALREADY_EXISTS',
    );
  });

  it('creates a single session for an active account and rotates its refresh token', async () => {
    const activeUser = user({
      passwordHash: await passwords.hash('password-yang-panjang'),
    });
    database.user.findUnique.mockResolvedValue(activeUser);

    const login = await service.login(
      activeUser.email,
      'password-yang-panjang',
    );
    expect(login.accessToken).toBeTruthy();
    expect(login.refreshToken).toBeTruthy();
    expect(database.user.update).toHaveBeenCalledWith({
      where: { id: activeUser.id },
      data: { refreshTokenHash: expect.stringMatching(/^\$2[aby]\$\d{2}\$/) },
    });

    activeUser.refreshTokenHash =
      database.user.update.mock.calls[0][0].data.refreshTokenHash;
    const refreshed = await service.refresh(login.refreshToken);
    expect(refreshed.accessToken).toBeTruthy();
    expect(database.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: activeUser.id,
        refreshTokenHash: expect.stringMatching(/^\$2[aby]\$\d{2}\$/),
      },
      data: { refreshTokenHash: expect.stringMatching(/^\$2[aby]\$\d{2}\$/) },
    });
  });

  it('rejects pending, rejected, and inactive accounts even with a correct password', async () => {
    for (const accountStatus of [
      AccountStatus.PENDING_VERIFICATION,
      AccountStatus.REJECTED,
      AccountStatus.NONACTIVE,
    ]) {
      const inactiveUser = user({
        accountStatus,
        passwordHash: await passwords.hash('password-yang-panjang'),
      });
      database.user.findUnique.mockResolvedValue(inactiveUser);
      await expectError(
        service.login(inactiveUser.email, 'password-yang-panjang'),
        `ACCOUNT_${accountStatus}`,
      );
    }
  });

  it('checks current account status again when an access token is used', async () => {
    const activeUser = user({
      passwordHash: await passwords.hash('password-yang-panjang'),
    });
    database.user.findUnique.mockResolvedValue(activeUser);
    const session = await service.login(
      activeUser.email,
      'password-yang-panjang',
    );
    activeUser.accountStatus = AccountStatus.NONACTIVE;

    await expectError(
      service.authenticateAccessToken(session.accessToken),
      'ACCOUNT_NONACTIVE',
    );
  });

  it('allows every active role to change its own password and replaces its session', async () => {
    const staff = user({
      role: UserRole.STAFF,
      passwordHash: await passwords.hash('password-yang-panjang'),
    });
    database.user.findUnique.mockResolvedValue(staff);

    const session = await service.changePassword(
      staff.id,
      'password-yang-panjang',
      'password-baru-panjang!',
    );

    expect(session.user.role).toBe(UserRole.STAFF);
    expect(database.user.update).toHaveBeenCalledWith({
      where: { id: staff.id },
      data: {
        passwordHash: expect.stringMatching(/^\$2[aby]\$\d{2}\$/),
        refreshTokenHash: expect.stringMatching(/^\$2[aby]\$\d{2}\$/),
      },
    });
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: staff.id,
        action: 'PASSWORD_CHANGED',
        entityType: 'USER',
        entityId: staff.id,
      },
    });
  });
});
