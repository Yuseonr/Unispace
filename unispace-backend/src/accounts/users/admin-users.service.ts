import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountStatus,
  type Prisma,
  UserRole,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { ListManagedUsersDto } from './dto/list-managed-users.dto';

const MANAGEABLE_ROLES: UserRole[] = [UserRole.USER, UserRole.STAFF];
const ACCOUNT_ENTITY_TYPE = 'USER';
const ACCOUNT_DEACTIVATED_REASON = 'Account deactivated by administrator.';

const managedUserSelect = {
  id: true,
  name: true,
  identityNumber: true,
  email: true,
  role: true,
  accountStatus: true,
  verificationReason: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
  verifiedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.UserSelect;

type ManagedUser = Prisma.UserGetPayload<{
  select: typeof managedUserSelect;
}>;

type AccountAuditEvent = {
  actorId: string;
  action: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
};

function isManageableRole(role: UserRole) {
  return role === UserRole.USER || role === UserRole.STAFF;
}

function jakartaReservationBoundary(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);

  const numberPart = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Unable to determine Jakarta ${type}.`);
    }
    return Number(value);
  };

  const year = numberPart('year');
  const month = numberPart('month');
  const day = numberPart('day');
  const hour = numberPart('hour');
  const minute = numberPart('minute');
  const second = numberPart('second');

  return {
    usageDate: new Date(Date.UTC(year, month - 1, day)),
    endTime: new Date(Date.UTC(1970, 0, 1, hour, minute, second)),
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
  ) {}

  async list(query: ListManagedUsersDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role ?? { in: MANAGEABLE_ROLES },
      ...(query.status === undefined ? {} : { accountStatus: query.status }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { identityNumber: { contains: query.search } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: managedUserSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((user) => this.toResponse(user)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async detail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: managedUserSelect,
    });
    if (!user || !isManageableRole(user.role)) {
      throw new NotFoundException({
        code: 'MANAGED_ACCOUNT_NOT_FOUND',
        message: 'User or staff account was not found.',
      });
    }
    return this.toResponse(user);
  }

  async create(adminId: string, input: CreateManagedUserDto) {
    const passwordHash = await this.passwords.hash(this.defaultUserPassword);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            name: input.name,
            identityNumber: input.identityNumber,
            email: input.email,
            passwordHash,
            role: input.role,
            accountStatus: AccountStatus.ACTIVE,
          },
          select: managedUserSelect,
        });
        await this.recordAudit(transaction, {
          actorId: adminId,
          action: 'ACCOUNT_CREATED_BY_ADMIN',
          entityId: user.id,
          metadata: { role: user.role, accountStatus: user.accountStatus },
        });
        return this.toResponse(user);
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({
          code: 'ACCOUNT_ALREADY_EXISTS',
          message:
            'An account with this email or NIM/NIP is already registered, including rejected or inactive accounts.',
        });
      }
      throw error;
    }
  }

  async verify(adminId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await this.getManagedUser(transaction, userId);
      this.assertStatus(user.accountStatus, AccountStatus.PENDING_VERIFICATION);

      const updated = await transaction.user.update({
        where: { id: user.id },
        data: {
          accountStatus: AccountStatus.ACTIVE,
          verificationReason: null,
          verifiedById: adminId,
          verifiedAt: new Date(),
        },
        select: managedUserSelect,
      });
      await this.recordAudit(transaction, {
        actorId: adminId,
        action: 'ACCOUNT_VERIFIED',
        entityId: user.id,
        metadata: {
          fromStatus: AccountStatus.PENDING_VERIFICATION,
          toStatus: AccountStatus.ACTIVE,
        },
      });
      return this.toResponse(updated);
    });
  }

  async reject(adminId: string, userId: string, reason: string) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await this.getManagedUser(transaction, userId);
      this.assertStatus(user.accountStatus, AccountStatus.PENDING_VERIFICATION);

      const updated = await transaction.user.update({
        where: { id: user.id },
        data: {
          accountStatus: AccountStatus.REJECTED,
          verificationReason: reason,
          verifiedById: adminId,
          verifiedAt: new Date(),
          refreshTokenHash: null,
        },
        select: managedUserSelect,
      });
      await this.recordAudit(transaction, {
        actorId: adminId,
        action: 'ACCOUNT_VERIFICATION_REJECTED',
        entityId: user.id,
        metadata: {
          fromStatus: AccountStatus.PENDING_VERIFICATION,
          toStatus: AccountStatus.REJECTED,
          reason,
        },
      });
      return this.toResponse(updated);
    });
  }

  async updateStatus(
    adminId: string,
    userId: string,
    status: Extract<AccountStatus, 'ACTIVE' | 'NONACTIVE'>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await this.getManagedUser(transaction, userId);
      const expectedCurrentStatus =
        status === AccountStatus.NONACTIVE
          ? AccountStatus.ACTIVE
          : AccountStatus.NONACTIVE;
      this.assertStatus(user.accountStatus, expectedCurrentStatus);

      if (status === AccountStatus.ACTIVE) {
        const updated = await transaction.user.update({
          where: { id: user.id },
          data: { accountStatus: AccountStatus.ACTIVE },
          select: managedUserSelect,
        });
        await this.recordAudit(transaction, {
          actorId: adminId,
          action: 'ACCOUNT_ACTIVATED',
          entityId: user.id,
          metadata: {
            fromStatus: AccountStatus.NONACTIVE,
            toStatus: AccountStatus.ACTIVE,
          },
        });
        return this.toResponse(updated);
      }

      const now = new Date();
      const boundary = jakartaReservationBoundary(now);
      const updated = await transaction.user.update({
        where: { id: user.id },
        data: {
          accountStatus: AccountStatus.NONACTIVE,
          refreshTokenHash: null,
        },
        select: managedUserSelect,
      });
      const pendingReservations = await transaction.reservation.updateMany({
        where: { userId: user.id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          decisionReason: ACCOUNT_DEACTIVATED_REASON,
          decidedAt: now,
          processedById: null,
        },
      });
      const approvedReservations = await transaction.reservation.updateMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
          OR: [
            { usageDate: { gt: boundary.usageDate } },
            {
              usageDate: boundary.usageDate,
              endTime: { gte: boundary.endTime },
            },
          ],
        },
        data: {
          status: 'CANCELLED_BY_SYSTEM',
          decisionReason: ACCOUNT_DEACTIVATED_REASON,
          cancelledAt: now,
          processedById: null,
        },
      });
      await this.recordAudit(transaction, {
        actorId: adminId,
        action: 'ACCOUNT_DEACTIVATED',
        entityId: user.id,
        metadata: {
          fromStatus: AccountStatus.ACTIVE,
          toStatus: AccountStatus.NONACTIVE,
          pendingReservationsRejected: pendingReservations.count,
          approvedReservationsCancelled: approvedReservations.count,
        },
      });
      return this.toResponse(updated);
    });
  }

  async resetPassword(adminId: string, userId: string) {
    const passwordHash = await this.passwords.hash(this.defaultUserPassword);

    return this.prisma.$transaction(async (transaction) => {
      const user = await this.getManagedUser(transaction, userId);
      if (
        user.accountStatus !== AccountStatus.ACTIVE &&
        user.accountStatus !== AccountStatus.NONACTIVE
      ) {
        this.statusTransitionError(
          `${AccountStatus.ACTIVE} or ${AccountStatus.NONACTIVE}`,
          user.accountStatus,
        );
      }

      const updated = await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash, refreshTokenHash: null },
        select: managedUserSelect,
      });
      await this.recordAudit(transaction, {
        actorId: adminId,
        action: 'ACCOUNT_PASSWORD_RESET',
        entityId: user.id,
        metadata: { accountStatus: user.accountStatus },
      });
      return this.toResponse(updated);
    });
  }

  private async getManagedUser(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
  ) {
    const user = await client.user.findUnique({
      where: { id: userId },
    });
    if (!user || !isManageableRole(user.role)) {
      throw new NotFoundException({
        code: 'MANAGED_ACCOUNT_NOT_FOUND',
        message: 'User or staff account was not found.',
      });
    }
    return user;
  }

  private recordAudit(
    transaction: Prisma.TransactionClient,
    event: AccountAuditEvent,
  ) {
    return transaction.auditLog.create({
      data: {
        actorId: event.actorId,
        action: event.action,
        entityType: ACCOUNT_ENTITY_TYPE,
        entityId: event.entityId,
        ...(event.metadata === undefined ? {} : { metadata: event.metadata }),
      },
    });
  }

  private assertStatus(actual: AccountStatus, expected: AccountStatus) {
    if (actual !== expected) {
      this.statusTransitionError(expected, actual);
    }
  }

  private statusTransitionError(
    expected: string,
    actual: AccountStatus,
  ): never {
    throw new ConflictException({
      code: 'ACCOUNT_STATUS_TRANSITION_INVALID',
      message: `Account must be ${expected}; current status is ${actual}.`,
    });
  }

  private toResponse(user: ManagedUser) {
    return {
      id: user.id,
      name: user.name,
      identityNumber: user.identityNumber,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      verification: {
        reason: user.verificationReason,
        verifiedAt: user.verifiedAt,
        verifiedBy: user.verifiedBy,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private get defaultUserPassword() {
    return this.config.getOrThrow<string>('DEFAULT_USER_PASSWORD');
  }
}
