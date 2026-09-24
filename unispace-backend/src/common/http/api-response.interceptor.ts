import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';
import { responseMetadata } from './response-metadata';

type ApiSuccess<T> = {
  success: true;
  statusCode: number;
  requestId: string;
  timestamp: string;
  data: T;
};

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor<
  unknown,
  unknown
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data): ApiSuccess<unknown> | unknown => {
        if (response.headersSent) {
          return data;
        }

        return {
          success: true,
          ...responseMetadata(response, response.statusCode),
          data: data ?? null,
        };
      }),
    );
  }
}
