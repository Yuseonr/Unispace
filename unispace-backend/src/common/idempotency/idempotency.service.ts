import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { Prisma as PrismaNamespace } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;

type IdempotencyResult<T> = {
  cached: boolean;
  value: T;
};

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    actorId: string,
    rawKey: string,
    payload: unknown,
    operation: () => Promise<T>,
  ): Promise<T> {
    const key = this.normalizeKey(rawKey);
    const requestHash = this.hash(payload);
    const started = await this.begin(actorId, key, requestHash);

    if (started.cached) {
      return started.value as T;
    }

    try {
      const value = await operation();
      await this.complete(started.recordId, value);
      return value;
    } catch (error) {
      await this.release(started.recordId);
      throw error;
    }
  }

  private async begin(actorId: string, key: string, requestHash: string) {
    const now = new Date();
    await this.prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    try {
      const record = await this.prisma.idempotencyRecord.create({
        data: {
          actorId,
          key,
          requestHash,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        },
      });
      return { cached: false as const, recordId: record.id };
    } catch (error) {
      if (!(
        error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )) {
        throw error;
      }
    }

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { actorId_key: { actorId, key } },
      select: {
        id: true,
        requestHash: true,
        response: true,
        completedAt: true,
      },
    });
    if (!existing || existing.requestHash !== requestHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message:
          'Idempotency-Key sudah digunakan untuk request dengan isi berbeda.',
      });
    }
    if (!existing.completedAt) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        message: 'Request dengan Idempotency-Key yang sama masih diproses.',
      });
    }

    return {
      cached: true as const,
      value: existing.response as unknown,
    } satisfies IdempotencyResult<unknown>;
  }

  private async complete(recordId: string, value: unknown) {
    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        response: value as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  private async release(recordId: string) {
    await this.prisma.idempotencyRecord.delete({ where: { id: recordId } });
  }

  private normalizeKey(value: string) {
    const key = value.trim();
    if (key.length < 8 || key.length > 255) {
      throw new BadRequestException({
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key harus berisi 8 sampai 255 karakter.',
      });
    }
    return key;
  }

  private hash(value: unknown) {
    return createHash('sha256')
      .update(this.stableStringify(value))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
      )
      .join(',')}}`;
  }
}
