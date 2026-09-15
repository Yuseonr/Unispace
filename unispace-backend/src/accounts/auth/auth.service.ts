import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';

import { PrismaService } from '../../database/prisma.service';
import { AccountStatus, type User } from '../../generated/prisma/client';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshTokenPayload,
} from './auth.types';

type Session = {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(data: RegisterDto) {
    const passwordHash = await this.passwords.hash(data.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: data.name,
          identityNumber: data.identityNumber,
          email: data.email,
          passwordHash,
        },
      });
      await this.recordAudit(user.id, 'USER_REGISTERED');
      return this.toAuthUser(user);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        this.throwDuplicateAccount();
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<Session> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await this.passwords.verify(password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      });
    }

    this.assertActive(user);
    const session = await this.createSession(user);
    await this.recordAudit(user.id, 'AUTH_LOGIN');
    return session;
  }

  async refresh(refreshToken: string): Promise<Session> {
    const token = await this.verifyRefreshToken(refreshToken);
    const user = await this.getActiveUser(token.sub);
    if (
      !user.refreshTokenHash ||
      !(await this.passwords.verify(refreshToken, user.refreshTokenHash))
    ) {
      throw this.sessionEnded();
    }

    return this.createSession(user, user.refreshTokenHash);
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    try {
      const token = await this.verifyRefreshToken(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: token.sub },
      });
      if (
        user?.refreshTokenHash &&
        (await this.passwords.verify(refreshToken, user.refreshTokenHash))
      ) {
        const result = await this.prisma.user.updateMany({
          where: { id: user.id, refreshTokenHash: user.refreshTokenHash },
          data: { refreshTokenHash: null },
        });
        if (result.count) {
          await this.recordAudit(user.id, 'AUTH_LOGOUT');
        }
      }
    } catch {
      // The controller always removes the browser cookie, even if it is expired.
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<Session> {
    const user = await this.getActiveUser(userId);
    if (!(await this.passwords.verify(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'CURRENT_PASSWORD_INCORRECT',
        message: 'Current password is incorrect.',
      });
    }

    const session = await this.signTokens(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await this.passwords.hash(newPassword),
        refreshTokenHash: await this.passwords.hash(session.refreshToken),
      },
    });
    await this.recordAudit(user.id, 'PASSWORD_CHANGED');
    return { ...session, user: this.toAuthUser(user) };
  }

  async authenticateAccessToken(
    accessToken: string,
  ): Promise<AuthenticatedUser> {
    try {
      const token = await this.jwt.verifyAsync<AccessTokenPayload>(
        accessToken,
        {
          secret: this.accessSecret,
        },
      );
      if (token.type !== 'access' || !token.sub) {
        throw new Error();
      }
      return this.toAuthUser(await this.getActiveUser(token.sub));
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Access token is invalid or expired.',
      });
    }
  }

  private async createSession(
    user: User,
    previousRefreshHash?: string,
  ): Promise<Session> {
    const session = await this.signTokens(user);
    const refreshTokenHash = await this.passwords.hash(session.refreshToken);

    if (!previousRefreshHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash },
      });
      return { ...session, user: this.toAuthUser(user) };
    }

    const result = await this.prisma.user.updateMany({
      where: { id: user.id, refreshTokenHash: previousRefreshHash },
      data: { refreshTokenHash },
    });
    if (!result.count) {
      throw this.sessionEnded();
    }
    return { ...session, user: this.toAuthUser(user) };
  }

  private signTokens(user: User) {
    return Promise.all([
      this.jwt.signAsync(
        { sub: user.id, type: 'access' satisfies AccessTokenPayload['type'] },
        { secret: this.accessSecret, expiresIn: this.accessExpiresIn },
      ),
      this.jwt.signAsync(
        { sub: user.id, type: 'refresh' satisfies RefreshTokenPayload['type'] },
        { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn },
      ),
    ]).then(([accessToken, refreshToken]) => ({ accessToken, refreshToken }));
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const token = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.refreshSecret,
        },
      );
      if (token.type !== 'refresh' || !token.sub) {
        throw new Error();
      }
      return token;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired.',
      });
    }
  }

  private async getActiveUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      });
    }
    this.assertActive(user);
    return user;
  }

  private assertActive(user: User) {
    if (user.accountStatus === AccountStatus.ACTIVE) {
      return;
    }

    const message = {
      [AccountStatus.PENDING_VERIFICATION]:
        'Your account is pending verification.',
      [AccountStatus.REJECTED]: 'Your account registration was rejected.',
      [AccountStatus.NONACTIVE]: 'Your account is inactive.',
      [AccountStatus.ACTIVE]: 'Your account is active.',
    }[user.accountStatus];
    throw new ForbiddenException({
      code: `ACCOUNT_${user.accountStatus}`,
      message,
      ...(user.accountStatus === AccountStatus.REJECTED &&
      user.verificationReason
        ? { details: { reason: user.verificationReason } }
        : {}),
    });
  }

  private toAuthUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      identityNumber: user.identityNumber,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    };
  }

  private recordAudit(actorId: string, action: string) {
    return this.prisma.auditLog.create({
      data: { actorId, action, entityType: 'USER', entityId: actorId },
    });
  }

  private sessionEnded() {
    return new UnauthorizedException({
      code: 'REFRESH_TOKEN_REVOKED',
      message: 'Your session has ended. Please sign in again.',
    });
  }

  private throwDuplicateAccount(): never {
    throw new ConflictException({
      code: 'ACCOUNT_ALREADY_EXISTS',
      message:
        'An account with this email or NIM/NIP is already registered, including rejected or inactive accounts.',
    });
  }

  private get accessSecret() {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private get refreshSecret() {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private get accessExpiresIn() {
    return this.config.getOrThrow<string>(
      'JWT_ACCESS_EXPIRES_IN',
    ) as StringValue;
  }

  private get refreshExpiresIn() {
    return this.config.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) as StringValue;
  }
}
