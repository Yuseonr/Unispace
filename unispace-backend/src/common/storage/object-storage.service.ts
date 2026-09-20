import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { StorageProvider } from '../../generated/prisma/client';

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
			forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
		});
	}

	async uploadReportPhoto(file: Express.Multer.File) {
		const bucket = this.config.getOrThrow<string>('S3_BUCKET');
		const objectKey = `reports/${randomUUID()}-${file.originalname}`;

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
			objectUrl: this.objectUrl(bucket, objectKey),
			originalFilename: file.originalname,
			mimeType: file.mimetype,
			sizeBytes: file.size,
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

	private objectUrl(bucket: string, objectKey: string) {
		const baseUrl =
			this.config.get<string>('S3_PUBLIC_URL') ??
			this.config.getOrThrow<string>('S3_ENDPOINT');
		return `${baseUrl.replace(/\/$/, '')}/${bucket}/${objectKey}`;
	}

	private get provider() {
		return this.config.get<string>('STORAGE_PROVIDER') === StorageProvider.S3
			? StorageProvider.S3
			: StorageProvider.MINIO;
	}
}