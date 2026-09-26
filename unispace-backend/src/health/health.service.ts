import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  live() {
    return { status: 'ok', service: 'unispace-backend' };
  }

  async ready() {
    const [database, storage] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.storage.checkHealth(),
    ]);
    const checks = {
      database: database.status === 'fulfilled' ? 'ok' : 'failed',
      storage: storage.status === 'fulfilled' ? 'ok' : 'failed',
    } as const;

    if (database.status === 'rejected' || storage.status === 'rejected') {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'Backend belum siap melayani request.',
        details: checks,
      });
    }

    return { status: 'ok', checks };
  }
}
