import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsDto) {
    const where = this.where(query);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        metadata: item.metadata ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async listForExport(query: ListAuditLogsDto) {
    const rows = await this.prisma.auditLog.findMany({
      where: this.where(query),
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, role: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10_001,
    });
    if (rows.length > 10_000) {
      throw new BadRequestException({
        code: 'AUDIT_EXPORT_TOO_LARGE',
        message:
          'Hasil audit terlalu besar. Persempit rentang atau filter export.',
      });
    }
    return rows.map((item) => ({
      ...item,
      metadata: item.metadata ?? null,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  private where(query: ListAuditLogsDto): Prisma.AuditLogWhereInput {
    const from = query.from
      ? this.parseBoundary(query.from, 'from')
      : undefined;
    const to = query.to ? this.parseBoundary(query.to, 'to') : undefined;
    if (from && to && from > to) {
      throw new BadRequestException({
        code: 'INVALID_AUDIT_DATE_RANGE',
        message: 'Tanggal awal audit tidak boleh setelah tanggal akhir.',
      });
    }
    return {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
  }

  private parseBoundary(value: string, kind: 'from' | 'to') {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(
      dateOnly
        ? `${value}T${kind === 'from' ? '00:00:00.000' : '23:59:59.999'}+07:00`
        : value,
    );
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_AUDIT_DATE',
        message: 'Tanggal audit tidak valid.',
      });
    }
    return parsed;
  }
}
