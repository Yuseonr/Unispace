import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { responseMetadata } from './response-metadata';

const FIRST_SERVER_ERROR_STATUS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return 'An unexpected error occurred.';
}

function errorCode(payload: Record<string, unknown>, status: number): string {
  if (typeof payload.code === 'string') {
    return payload.code;
  }
  if (status >= FIRST_SERVER_ERROR_STATUS) {
    return 'INTERNAL_SERVER_ERROR';
  }
  return `HTTP_${status}`;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) {
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const payload = isRecord(body) ? body : { message: body };
    const code = errorCode(payload, status);
    const metadata = responseMetadata(response, status);

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled exception. requestId=${metadata.requestId}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      ...metadata,
      error: {
        code,
        message: errorMessage(payload.message),
        ...(payload.details === undefined ? {} : { details: payload.details }),
      },
    });
  }
}
