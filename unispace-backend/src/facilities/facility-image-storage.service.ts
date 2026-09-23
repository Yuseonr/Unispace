import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

const IMAGE_PREFIX = 'facility-primary';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const allowedImageTypes = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export type StoredFacilityImage = {
  fileName: string;
  objectKey: string;
  url: string;
  contentType: string;
  sizeBytes: number;
};

/** Minimal shape dari file memory-storage yang dipakai endpoint upload. */
export type FacilityImageUpload = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname?: string;
};

export type RetrievedFacilityImage = {
  body: Readable;
  contentType: string;
  contentLength?: number;
};

/**
 * Menyimpan foto utama fasilitas di provider S3-compatible (MinIO/S3).
 * Bucket tetap private; gambar dipublikasikan hanya lewat endpoint read-only.
 */
@Injectable()
export class FacilityImageStorageService {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  async uploadPrimaryImage(
    file: FacilityImageUpload,
  ): Promise<StoredFacilityImage> {
    this.assertValidUpload(file);

    const extension = allowedImageTypes.get(file.mimetype);
    if (!extension) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FACILITY_IMAGE_TYPE',
        message: 'Foto fasilitas harus berupa JPEG, PNG, atau WebP.',
      });
    }

    const fileName = `${randomUUID()}.${extension}`;
    const objectKey = this.toObjectKey(fileName);

    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: this.requiredConfig('S3_BUCKET'),
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentLength: file.size,
        }),
      );
    } catch {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_UNAVAILABLE',
        message: 'Foto fasilitas belum dapat disimpan. Coba lagi sesaat lagi.',
      });
    }

    return {
      fileName,
      objectKey,
      url: `${this.publicApiBaseUrl()}/facilities/images/${fileName}`,
      contentType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  async getPrimaryImage(fileName: string): Promise<RetrievedFacilityImage> {
    const objectKey = this.toObjectKey(fileName);
    let result: GetObjectCommandOutput;

    try {
      result = await this.getClient().send(
        new GetObjectCommand({
          Bucket: this.requiredConfig('S3_BUCKET'),
          Key: objectKey,
        }),
      );
    } catch (error) {
      if (this.isMissingObject(error)) {
        throw new NotFoundException({
          code: 'FACILITY_IMAGE_NOT_FOUND',
          message: 'Foto fasilitas tidak ditemukan.',
        });
      }

      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_UNAVAILABLE',
        message: 'Foto fasilitas belum dapat dimuat. Coba lagi sesaat lagi.',
      });
    }

    if (!(result.Body instanceof Readable)) {
      throw new InternalServerErrorException({
        code: 'INVALID_OBJECT_STORAGE_RESPONSE',
        message: 'Penyimpanan foto mengembalikan respons yang tidak valid.',
      });
    }

    return {
      body: result.Body,
      contentType: result.ContentType ?? 'application/octet-stream',
      contentLength: result.ContentLength,
    };
  }

  private assertValidUpload(
    file?: FacilityImageUpload,
  ): asserts file is FacilityImageUpload {
    if (!file) {
      throw new BadRequestException({
        code: 'PRIMARY_IMAGE_REQUIRED',
        message: 'Foto utama fasilitas wajib diunggah.',
      });
    }

    if (!allowedImageTypes.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FACILITY_IMAGE_TYPE',
        message: 'Foto fasilitas harus berupa JPEG, PNG, atau WebP.',
      });
    }

    if (!file.buffer || file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'INVALID_FACILITY_IMAGE_SIZE',
        message: 'Ukuran foto fasilitas harus lebih dari 0 dan maksimal 5 MB.',
      });
    }
  }

  private getClient() {
    if (!this.client) {
      this.client = new S3Client({
        endpoint: this.requiredConfig('S3_ENDPOINT'),
        region: this.config.get<string>('S3_REGION') ?? 'ap-southeast-1',
        credentials: {
          accessKeyId: this.requiredConfig('S3_ACCESS_KEY'),
          secretAccessKey: this.requiredConfig('S3_SECRET_KEY'),
        },
        forcePathStyle:
          this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      });
    }

    return this.client;
  }

  private publicApiBaseUrl() {
    const configuredUrl = this.config.get<string>('PUBLIC_API_URL')?.trim();
    if (configuredUrl) {
      return configuredUrl.replace(/\/$/, '');
    }

    const port = this.config.get<string>('PORT') ?? '3000';
    return `http://localhost:${port}/api/v1`;
  }

  private requiredConfig(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) {
      throw new InternalServerErrorException({
        code: 'OBJECT_STORAGE_CONFIGURATION_MISSING',
        message: `Konfigurasi ${name} belum tersedia.`,
      });
    }
    return value;
  }

  private toObjectKey(fileName: string) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(fileName)) {
      throw new BadRequestException({
        code: 'INVALID_FACILITY_IMAGE_NAME',
        message: 'Nama foto fasilitas tidak valid.',
      });
    }
    return `${IMAGE_PREFIX}/${fileName}`;
  }

  private isMissingObject(error: unknown) {
    const statusCode =
      typeof error === 'object' && error !== null && '$metadata' in error
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode
        : undefined;
    const name =
      typeof error === 'object' && error !== null && 'name' in error
        ? (error as { name?: string }).name
        : undefined;

    return statusCode === 404 || name === 'NoSuchKey' || name === 'NotFound';
  }
}
