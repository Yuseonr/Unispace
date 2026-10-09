import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FacilityAreaStatus,
  FacilityTypeStatus,
  type Prisma,
} from '../../generated/prisma/client';
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
    return this.prisma.facilityType.findMany({
      where: { status: FacilityTypeStatus.ACTIVE },
      orderBy: { name: 'asc' },
    });
  }

  async listActiveAreas() {
    return this.prisma.facilityArea.findMany({
      where: { status: FacilityAreaStatus.ACTIVE },
      orderBy: { name: 'asc' },
    });
  }

  async adminListTypes() {
    return this.prisma.facilityType.findMany({
      include: { _count: { select: { facilityGroups: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async adminCreateType(adminId: string, input: CreateFacilityTypeDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const type = await tx.facilityType.create({
          data: { name: input.name, status: FacilityTypeStatus.ACTIVE },
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

  async adminUpdateTypeStatus(
    adminId: string,
    typeId: string,
    status: FacilityTypeStatus,
  ) {
    const type = await this.prisma.facilityType.findUnique({
      where: { id: typeId },
      include: { _count: { select: { facilityGroups: true } } },
    });
    if (!type) {
      throw new NotFoundException('Tipe fasilitas tidak ditemukan.');
    }
    if (type.status === status) {
      return type;
    }
    if (
      status === FacilityTypeStatus.NONACTIVE &&
      type._count.facilityGroups > 0
    ) {
      throw new ConflictException({
        code: 'FACILITY_TYPE_STILL_REFERENCED',
        message:
          'Tipe fasilitas tidak dapat dinonaktifkan karena masih digunakan oleh grup fasilitas.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.facilityType.update({
        where: { id: typeId },
        data: { status },
        include: { _count: { select: { facilityGroups: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action:
            status === FacilityTypeStatus.ACTIVE
              ? 'FACILITY_TYPE_ACTIVATED'
              : 'FACILITY_TYPE_DEACTIVATED',
          entityType: 'FACILITY_TYPE',
          entityId: typeId,
          metadata: { fromStatus: type.status, toStatus: status },
        },
      });
      return updated;
    });
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
          data: {
            code: input.code,
            name: input.name,
            status: FacilityAreaStatus.ACTIVE,
          },
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
