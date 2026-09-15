import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { jest } from '@jest/globals';
import { UserRole } from '../../../generated/prisma/client';
import { RolesGuard } from './roles.guard';

const context = (user?: { role: UserRole }) =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as never;

describe('RolesGuard', () => {
  it('allows a matching role and rejects every other role', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(context({ role: UserRole.ADMIN }))).toBe(true);

    reflector.getAllAndOverride
      .mockReset()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([UserRole.ADMIN]);
    expect(() => guard.canActivate(context({ role: UserRole.STAFF }))).toThrow(
      ForbiddenException,
    );
  });

  it('skips authorization for public routes', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(context({ role: UserRole.USER }))).toBe(true);
  });
});
