import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth.constants';
import type { AuthenticatedUser } from '../auth.types';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const roles = this.reflector.getAllAndOverride<AuthenticatedUser['role'][]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user && roles.includes(request.user.role)) {
      return true;
    }
    throw new ForbiddenException({
      code: 'ROLE_FORBIDDEN',
      message: 'Your role is not allowed to access this resource.',
    });
  }
}
