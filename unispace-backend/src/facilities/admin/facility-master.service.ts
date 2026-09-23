import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FacilityAreaStatus, type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateFacilityAreaDto,
  CreateFacilityTypeDto,
  UpdateFacilityAreaDto,
  UpdateFacilityTypeDto,
} from '../dto/admin';

/** Master facility type dan facility area yang dikelola ADMIN. */
@Injectable()
export class FacilityMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async listTypes() {
    return this.prisma.facilityType.findMany({ orderBy: { name: 'asc' } });
  }

  async listActiveAreas() {
    return this.prisma.facilityArea.findMany({
      where: { status: FacilityAreaStatus.ACTIVE },
      orderBy: { name: 'asc' },
    });
  }

  async adminListTypes() {
    return this.listTypes();
  }

  async adminCreateType(adminId: string, input: CreateFacilityTypeDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const type = await tx.facilityType.create({
          data: { name: input.name },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_TYPE_CREATED',
            entityType: 'FACILITY_TYPE',
            entityId: type.id,
            metadata: { name: type.name },
          },
        });
        return type;
      });
    } catch (error) {
      this.throwIfUniqueConstraint(
        error,
        'Nama tipe fasilitas sudah digunakan.',
      );
      throw error;
    }
  }

  async adminUpdateType(
    adminId: string,
    typeId: string,
    input: UpdateFacilityTypeDto,
  ) {
    const existing = await this.prisma.facilityType.findUnique({
      where: { id: typeId },
    });
    if (!existing) {
      throw new NotFoundException('Tipe fasilitas tidak ditemukan.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const type = await tx.facilityType.update({
          where: { id: typeId },
          data: input.name === undefined ? {} : { name: input.name },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_TYPE_UPDATED',
            entityType: 'FACILITY_TYPE',
            entityId: typeId,
            metadata: { changes: input as Prisma.InputJsonValue },
          },
        });
        return type;
      });
    } catch (error) {
      this.throwIfUniqueConstraint(
        error,
        'Nama tipe fasilitas sudah digunakan.',
      );
      throw error;
    }
  }

  async adminListAreas() {
    return this.prisma.facilityArea.findMany({
      include: { _count: { select: { facilityGroups: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async adminCreateArea(adminId: string, input: CreateFacilityAreaDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const area = await tx.facilityArea.create({
          data: { code: input.code, name: input.name },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_AREA_CREATED',
            entityType: 'FACILITY_AREA',
            entityId: area.id,
            metadata: { code: area.code, name: area.name },
          },
        });
        return area;
      });
    } catch (error) {
      this.throwIfUniqueConstraint(
        error,
        'Kode atau nama area fasilitas sudah digunakan.',
      );
      throw error;
    }
  }

  async adminUpdateArea(
    adminId: string,
    areaId: string,
    input: UpdateFacilityAreaDto,
  ) {
    const existing = await this.prisma.facilityArea.findUnique({
      where: { id: areaId },
    });
    if (!existing) {
      throw new NotFoundException('Area fasilitas tidak ditemukan.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const area = await tx.facilityArea.update({
          where: { id: areaId },
          data: {
            ...(input.code === undefined ? {} : { code: input.code }),
            ...(input.name === undefined ? {} : { name: input.name }),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_AREA_UPDATED',
            entityType: 'FACILITY_AREA',
            entityId: areaId,
            metadata: { changes: input as Prisma.InputJsonValue },
          },
        });
        return area;
      });
    } catch (error) {
      this.throwIfUniqueConstraint(
        error,
        'Kode atau nama area fasilitas sudah digunakan.',
      );
      throw error;
    }
  }

  async adminUpdateAreaStatus(
    adminId: string,
    areaId: string,
    status: FacilityAreaStatus,
  ) {
    const area = await this.prisma.facilityArea.findUnique({
      where: { id: areaId },
      include: { _count: { select: { facilityGroups: true } } },
    });
    if (!area) {
      throw new NotFoundException('Area fasilitas tidak ditemukan.');
    }
    if (area.status === status) {
      return area;
    }
    if (status === FacilityAreaStatus.NONACTIVE && area._count.facilityGroups) {
      throw new ConflictException({
        code: 'FACILITY_AREA_STILL_REFERENCED',
        message:
          'Area tidak dapat dinonaktifkan karena masih digunakan oleh grup fasilitas.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.facilityArea.update({
        where: { id: areaId },
        data: { status },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action:
            status === FacilityAreaStatus.ACTIVE
              ? 'FACILITY_AREA_ACTIVATED'
              : 'FACILITY_AREA_DEACTIVATED',
          entityType: 'FACILITY_AREA',
          entityId: areaId,
          metadata: { fromStatus: area.status, toStatus: status },
        },
      });
      return updated;
    });
  }

  private throwIfUniqueConstraint(
    error: unknown,
    message: string,
  ): never | void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'FACILITY_UNIQUE_VALUE_EXISTS',
        message,
      });
    }
  }
}
