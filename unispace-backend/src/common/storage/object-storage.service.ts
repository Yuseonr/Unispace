import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { StorageProvider } from '../../generated/prisma/client';
import {
  type DetectedImage,
  validateImageUpload,
} from './image-upload.validation';

const MAX_REPORT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type RetrievedReportPhoto = {
  body: Readable;
  contentType: string;
  contentLength?: number;
};

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      endpoint: this.config.getOrThrow<string>('S3_ENDPOINT'),
      region: this.config.getOrThrow<string>('S3_REGION'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      forcePathStyle:
        this.config.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
    });
  }

  async uploadReportPhoto(file: Express.Multer.File) {
    const image = this.assertValidReportPhoto(file);
    const bucket = this.config.getOrThrow<string>('S3_BUCKET');
    const objectKey = `reports/${randomUUID()}.${image.extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      storageProvider: this.provider,
      objectKey,
      objectUrl: `s3://${bucket}/${objectKey}`,
      originalFilename: file.originalname,
      mimeType: image.mimeType,
      sizeBytes: file.size,
    };
  }

  async getReportPhoto(objectKey: string): Promise<RetrievedReportPhoto> {
    if (!objectKey.startsWith('reports/')) {
      throw new BadRequestException({
        code: 'INVALID_REPORT_ATTACHMENT_KEY',
        message: 'Kunci attachment laporan tidak valid.',
      });
    }

    let result: GetObjectCommandOutput;
    try {
      result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.getOrThrow<string>('S3_BUCKET'),
          Key: objectKey,
        }),
      );
    } catch (error) {
      if (this.isMissingObject(error)) {
        throw new NotFoundException({
          code: 'REPORT_ATTACHMENT_NOT_FOUND',
          message: 'Foto laporan tidak ditemukan.',
        });
      }
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORAGE_UNAVAILABLE',
        message: 'Foto laporan belum dapat dimuat. Coba lagi sesaat lagi.',
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

  async remove(objectKey: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.getOrThrow<string>('S3_BUCKET'),
        Key: objectKey,
      }),
    );
  }

  async checkHealth() {
    await this.client.send(
      new HeadBucketCommand({
        Bucket: this.config.getOrThrow<string>('S3_BUCKET'),
      }),
    );
  }

  private assertValidReportPhoto(
    file: Express.Multer.File | undefined,
  ): DetectedImage {
    return validateImageUpload(file, {
      maxSizeBytes: MAX_REPORT_IMAGE_SIZE_BYTES,
      requiredCode: 'REPORT_PHOTO_REQUIRED',
      requiredMessage: 'Foto laporan wajib diunggah.',
      unsupportedCode: 'UNSUPPORTED_REPORT_PHOTO_TYPE',
      unsupportedMessage: 'Foto laporan harus berupa JPEG, PNG, atau WebP.',
      invalidSizeCode: 'INVALID_REPORT_PHOTO_SIZE',
      invalidSizeMessage:
        'Ukuran foto laporan harus lebih dari 0 dan maksimal 5 MB.',
      invalidContentCode: 'INVALID_REPORT_PHOTO_CONTENT',
      invalidContentMessage:
        'Isi foto laporan harus cocok dengan format JPEG, PNG, atau WebP.',
    });
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

  private get provider() {
    return this.config.get<string>('STORAGE_PROVIDER') === StorageProvider.S3
      ? StorageProvider.S3
      : StorageProvider.MINIO;
  }
}
