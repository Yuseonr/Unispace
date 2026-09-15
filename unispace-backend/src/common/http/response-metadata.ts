import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

export function responseMetadata(response: Response, statusCode: number) {
  const requestId = randomUUID();
  response.setHeader('X-Request-Id', requestId);

  return {
    statusCode,
    requestId,
    timestamp: new Date().toISOString(),
  };
}
