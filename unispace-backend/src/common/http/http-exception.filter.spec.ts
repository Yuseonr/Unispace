import { Logger, type ArgumentsHost } from '@nestjs/common';
import { jest } from '@jest/globals';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('hides unexpected exception details from the client', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new Error('database password must never reach the client'),
      host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
        },
      }),
    );
  });
});
