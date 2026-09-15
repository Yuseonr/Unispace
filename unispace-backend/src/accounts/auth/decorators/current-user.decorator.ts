import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth.types';

type RequestWithUser = Request & { user?: AuthenticatedUser };

export const CurrentUser = createParamDecorator(
  (ignoredData: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user!;
  },
);
