import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FacilityStatus,
  type Prisma,
  ReservationMode,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateFacilityGroupDto,
  CreateFacilityUnitDto,
  UpdateFacilityGroupDto,
  UpdateFacilityUnitDto,
} from '../dto/admin';
import {
  FacilityImageStorageService,
  type FacilityImageUpload,
} from '../facility-image-storage.service';

/** Mutasi group dan unit fisik fasilitas yang hanya boleh dilakukan ADMIN. */
@Injectable()
export class FacilityManagementService {
  private readonly logger = new Logger(FacilityManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: FacilityImageStorageService,
  ) {}

  async adminCreateGroup(
    adminId: string,
    input: CreateFacilityGroupDto,
    primaryImage?: FacilityImageUpload,
  ) {
    const typeExists = await this.prisma.facilityType.findUnique({
      where: { id: input.facilityTypeId },
    });
    if (!typeExists) {
      throw new NotFoundException('Tipe fasilitas tidak ditemukan.');
    }
    const area = await this.prisma.facilityArea.findFirst({
      where: { id: input.facilityAreaId, status: 'ACTIVE' },
    });
    if (!area) {
      throw new NotFoundException(
        'Fakultas/area kampus aktif tidak ditemukan.',
      );
    }
    if (
      input.reservationMode === ReservationMode.EXCLUSIVE &&
      !input.assetCode
    ) {
      throw new BadRequestException({
        code: 'EXCLUSIVE_ASSET_CODE_REQUIRED',
        message: 'Kode aset wajib diisi untuk fasilitas mode EXCLUSIVE.',
      });
    }
    if (input.reservationMode === ReservationMode.EXCLUSIVE) {
      const existingAsset = await this.prisma.facility.findUnique({
        where: { assetCode: input.assetCode! },
      });
      if (existingAsset) {
        throw new ConflictException({
          code: 'FACILITY_ASSET_CODE_EXISTS',
          message: `Kode aset "${input.assetCode}" sudah digunakan.`,
        });
      }
    }

    const uploadedImage = await this.imageStorage.uploadPrimaryImage(
      primaryImage!,
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const group = await tx.facilityGroup.create({
          data: {
            name: input.name,
            facilityTypeId: input.facilityTypeId,
            reservationMode: input.reservationMode,
            facilityAreaId: input.facilityAreaId,
            locationDetail: input.locationDetail,
            capacity: input.capacity,
            description: input.description,
            primaryImageUrl: uploadedImage.url,
            primaryImageObjectKey: uploadedImage.objectKey,
          },
          include: {
            facilityType: { select: { id: true, name: true } },
            facilityArea: { select: { id: true, code: true, name: true } },
          },
        });
        const initialUnit =
          input.reservationMode === ReservationMode.EXCLUSIVE
            ? await tx.facility.create({
                data: {
                  facilityGroupId: group.id,
                  assetCode: input.assetCode!,
                  name: input.name,
                  capacity: input.capacity,
                  description: input.description,
                  primaryImageUrl: uploadedImage.url,
                  primaryImageObjectKey: uploadedImage.objectKey,
                  status: FacilityStatus.ACTIVE,
                },
              })
            : null;
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_GROUP_CREATED',
            entityType: 'FACILITY_GROUP',
            entityId: group.id,
            metadata: {
              name: group.name,
              reservationMode: group.reservationMode,
              initialAssetCode: input.assetCode ?? null,
              imageObjectKey: uploadedImage.objectKey,
            },
          },
        });
        return { ...group, initialUnit };
      });
    } catch (error) {
      await this.removeUploadedImageAfterFailedTransaction(
        uploadedImage.objectKey,
      );
      this.throwIfUniqueConstraint(
        error,
        'Kode aset fasilitas sudah digunakan.',
      );
      throw error;
    }
  }

  async adminUpdateGroup(
    adminId: string,
    groupId: string,
    input: UpdateFacilityGroupDto,
    primaryImage?: FacilityImageUpload,
  ) {
    const existingGroup = await this.prisma.facilityGroup.findUnique({
      where: { id: groupId },
      include: {
        facilities: {
          select: { id: true, primaryImageObjectKey: true },
        },
      },
    });
    if (!existingGroup) {
      throw new NotFoundException('Kelompok fasilitas tidak ditemukan.');
    }
    if (input.facilityTypeId) {
      const typeExists = await this.prisma.facilityType.findUnique({
        where: { id: input.facilityTypeId },
      });
      if (!typeExists) {
        throw new NotFoundException('Tipe fasilitas tidak ditemukan.');
      }
    }
    if (input.facilityAreaId) {
      const area = await this.prisma.facilityArea.findFirst({
        where: { id: input.facilityAreaId, status: 'ACTIVE' },
      });
      if (!area) {
        throw new NotFoundException(
          'Fakultas/area kampus aktif tidak ditemukan.',
        );
      }
    }
    const uploadedImage = primaryImage
      ? await this.imageStorage.uploadPrimaryImage(primaryImage)
      : undefined;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.facilityGroup.update({
          where: { id: groupId },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.facilityTypeId === undefined
              ? {}
              : { facilityTypeId: input.facilityTypeId }),
            ...(input.facilityAreaId === undefined
              ? {}
              : { facilityAreaId: input.facilityAreaId }),
            ...(input.locationDetail === undefined
              ? {}
              : { locationDetail: input.locationDetail }),
            ...(input.capacity === undefined
              ? {}
              : { capacity: input.capacity }),
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
            ...(uploadedImage === undefined
              ? {}
              : {
                  primaryImageUrl: uploadedImage.url,
                  primaryImageObjectKey: uploadedImage.objectKey,
                }),
          },
          include: {
            facilityType: { select: { id: true, name: true } },
            facilityArea: { select: { id: true, code: true, name: true } },
          },
        });
        if (existingGroup.reservationMode === ReservationMode.EXCLUSIVE) {
          const unit =
            existingGroup.facilities?.[0] ??
            (await tx.facility.findFirst({
              where: { facilityGroupId: groupId },
              select: { id: true, primaryImageObjectKey: true },
            }));
          if (!unit) {
            throw new ConflictException({
              code: 'EXCLUSIVE_UNIT_MISSING',
              message: 'Fasilitas EXCLUSIVE harus memiliki satu unit fisik.',
            });
          }
          await tx.facility.update({
            where: { id: unit.id },
            data: {
              ...(input.name === undefined ? {} : { name: input.name }),
              ...(input.capacity === undefined
                ? {}
                : { capacity: input.capacity }),
              ...(input.description === undefined
                ? {}
                : { description: input.description }),
              ...(uploadedImage === undefined
                ? {}
                : {
                    primaryImageUrl: uploadedImage.url,
                    primaryImageObjectKey: uploadedImage.objectKey,
                  }),
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_GROUP_UPDATED',
            entityType: 'FACILITY_GROUP',
            entityId: groupId,
            metadata: {
              changes: input as unknown as Prisma.InputJsonValue,
              imageObjectKey: uploadedImage?.objectKey ?? null,
            },
          },
        });
        return result;
      });

      if (uploadedImage) {
        await this.removeReplacedImages(
          [
            existingGroup.primaryImageObjectKey,
            ...(existingGroup.facilities ?? []).map(
              (facility) => facility.primaryImageObjectKey,
            ),
          ],
          uploadedImage.objectKey,
        );
      }
      return updated;
    } catch (error) {
      if (uploadedImage) {
        await this.removeUploadedImageAfterFailedTransaction(
          uploadedImage.objectKey,
        );
      }
      throw error;
    }
  }

  async adminCreateUnit(adminId: string, input: CreateFacilityUnitDto) {
    const group = await this.prisma.facilityGroup.findUnique({
      where: { id: input.facilityGroupId },
    });
    if (!group) {
      throw new NotFoundException('Kelompok fasilitas tidak ditemukan.');
    }
    if (group.reservationMode !== ReservationMode.QUANTITY) {
      throw new BadRequestException({
        code: 'EXCLUSIVE_UNIT_ALREADY_MANAGED',
        message:
          'Unit tambahan hanya dapat dibuat pada fasilitas mode QUANTITY.',
      });
    }
    const existingAsset = await this.prisma.facility.findUnique({
      where: { assetCode: input.assetCode },
    });
    if (existingAsset) {
      throw new ConflictException({
        code: 'FACILITY_ASSET_CODE_EXISTS',
        message: `Kode aset "${input.assetCode}" sudah digunakan.`,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.facility.create({
        data: {
          facilityGroupId: input.facilityGroupId,
          assetCode: input.assetCode,
          name: input.name ?? null,
          status: FacilityStatus.ACTIVE,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'FACILITY_UNIT_CREATED',
          entityType: 'FACILITY',
          entityId: unit.id,
          metadata: { assetCode: unit.assetCode, facilityGroupId: group.id },
        },
      });
      return unit;
    });
  }

  async adminUpdateUnit(
    adminId: string,
    facilityId: string,
    input: UpdateFacilityUnitDto,
    primaryImage?: FacilityImageUpload,
  ) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      include: { facilityGroup: true },
    });
    if (!facility) {
      throw new NotFoundException('Unit fasilitas tidak ditemukan.');
    }
    const existingFacility = facility;
    if (
      existingFacility.facilityGroup.reservationMode ===
        ReservationMode.QUANTITY &&
      (input.capacity !== undefined ||
        input.description !== undefined ||
        primaryImage)
    ) {
      throw new BadRequestException({
        code: 'QUANTITY_UNIT_CATALOG_METADATA_FORBIDDEN',
        message:
          'Kapasitas, deskripsi, dan foto alat QUANTITY dikelola pada grup fasilitas.',
      });
    }
    if (input.assetCode && input.assetCode !== existingFacility.assetCode) {
      const existingAsset = await this.prisma.facility.findUnique({
        where: { assetCode: input.assetCode },
      });
      if (existingAsset) {
        throw new ConflictException({
          code: 'FACILITY_ASSET_CODE_EXISTS',
          message: `Kode aset "${input.assetCode}" sudah digunakan.`,
        });
      }
    }
    const uploadedImage = primaryImage
      ? await this.imageStorage.uploadPrimaryImage(primaryImage)
      : undefined;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.facility.update({
          where: { id: facilityId },
          data: {
            ...(input.assetCode === undefined
              ? {}
              : { assetCode: input.assetCode }),
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.capacity === undefined
              ? {}
              : { capacity: input.capacity }),
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
            ...(uploadedImage === undefined
              ? {}
              : {
                  primaryImageUrl: uploadedImage.url,
                  primaryImageObjectKey: uploadedImage.objectKey,
                }),
          },
        });
        if (
          existingFacility.facilityGroup.reservationMode ===
          ReservationMode.EXCLUSIVE
        ) {
          await tx.facilityGroup.update({
            where: { id: existingFacility.facilityGroupId },
            data: {
              ...(input.name === undefined ? {} : { name: input.name }),
              ...(input.capacity === undefined
                ? {}
                : { capacity: input.capacity }),
              ...(input.description === undefined
                ? {}
                : { description: input.description }),
              ...(uploadedImage === undefined
                ? {}
                : {
                    primaryImageUrl: uploadedImage.url,
                    primaryImageObjectKey: uploadedImage.objectKey,
                  }),
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'FACILITY_UNIT_UPDATED',
            entityType: 'FACILITY',
            entityId: facilityId,
            metadata: {
              changes: input as Prisma.InputJsonValue,
              imageObjectKey: uploadedImage?.objectKey ?? null,
            },
          },
        });
        return updated;
      });

      if (uploadedImage) {
        await this.removeReplacedImages(
          [
            existingFacility.primaryImageObjectKey,
            existingFacility.facilityGroup.primaryImageObjectKey,
          ],
          uploadedImage.objectKey,
        );
      }
      return result;
    } catch (error) {
      if (uploadedImage) {
        await this.removeUploadedImageAfterFailedTransaction(
          uploadedImage.objectKey,
        );
      }
      this.throwIfUniqueConstraint(
        error,
        'Kode aset fasilitas sudah digunakan.',
      );
      throw error;
    }
  }

  async adminList() {
    return this.prisma.facilityGroup.findMany({
      include: {
        facilityType: { select: { id: true, name: true } },
        facilityArea: { select: { id: true, code: true, name: true } },
        facilities: {
          select: {
            id: true,
            assetCode: true,
            name: true,
            capacity: true,
            description: true,
            primaryImageUrl: true,
            status: true,
            createdAt: true,
          },
          orderBy: { assetCode: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
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

  private async removeUploadedImageAfterFailedTransaction(objectKey: string) {
    try {
      await this.imageStorage.removePrimaryImage(objectKey);
    } catch (error) {
      this.logger.error(
        `Tidak dapat membersihkan foto fasilitas baru setelah transaksi gagal: ${objectKey}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async removeReplacedImages(
    oldObjectKeys: Array<string | null>,
    newObjectKey: string,
  ) {
    const keys = [...new Set(oldObjectKeys)].filter(
      (objectKey): objectKey is string =>
        Boolean(objectKey) && objectKey !== newObjectKey,
    );
    await Promise.all(
      keys.map(async (objectKey) => {
        try {
          await this.imageStorage.removePrimaryImage(objectKey);
        } catch (error) {
          this.logger.error(
            `Tidak dapat menghapus foto fasilitas lama: ${objectKey}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }),
    );
  }
}
