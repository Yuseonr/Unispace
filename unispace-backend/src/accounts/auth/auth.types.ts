import type { AccountStatus, UserRole } from '../../generated/prisma/client';

export type AuthenticatedUser = {
  id: string;
  name: string;
  identityNumber: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
};

export type AccessTokenPayload = { sub: string; type: 'access' };
export type RefreshTokenPayload = { sub: string; type: 'refresh' };
