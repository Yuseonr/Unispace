import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { jest } from '@jest/globals';
import { Readable } from 'node:stream';
import {
  FacilityImageStorageService,
  type FacilityImageUpload,
} from './facility-image-storage.service';

const storageConfig = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'ap-southeast-1',
  S3_BUCKET: 'unispace-dev',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'miniosecret',
  S3_FORCE_PATH_STYLE: 'true',
  PUBLIC_API_URL: 'http://localhost:3001/api/v1',
};

const validImage = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
  size: 8,
  mimetype: 'image/jpeg',
} as FacilityImageUpload;

describe('FacilityImageStorageService', () => {
  let service: FacilityImageStorageService;
  let send: jest.Mock;

  beforeEach(() => {
    const config = {
      get: jest.fn(
        (key: string) => storageConfig[key as keyof typeof storageConfig],
      ),
    } as unknown as ConfigService;
    service = new FacilityImageStorageService(config);
    send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mengunggah JPEG ke private bucket dan menghasilkan URL proxy publik', async () => {
    send.mockResolvedValue({});

    const result = await service.uploadPrimaryImage(validImage);

    expect(result.objectKey).toMatch(/^facility-primary\/[0-9a-f-]{36}\.jpg$/);
    expect(result.url).toBe(
      `http://localhost:3001/api/v1/facilities/images/${result.fileName}`,
    );
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'unispace-dev',
      Key: result.objectKey,
      Body: validImage.buffer,
      ContentType: 'image/jpeg',
      ContentLength: validImage.size,
    });
  });

  it('menolak format gambar yang tidak didukung sebelum memanggil object storage', async () => {
    await expect(
      service.uploadPrimaryImage({
        ...validImage,
        mimetype: 'image/gif',
      } as FacilityImageUpload),
    ).rejects.toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('menolak MIME image yang isinya bukan signature gambar valid', async () => {
    await expect(
      service.uploadPrimaryImage({
        ...validImage,
        buffer: Buffer.from('bukan-file-gambar'),
        size: 17,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('mewajibkan file foto utama saat fasilitas dibuat', async () => {
    await expect(
      service.uploadPrimaryImage(undefined as unknown as FacilityImageUpload),
    ).rejects.toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('menerjemahkan kegagalan object storage saat upload menjadi respons 503', async () => {
    send.mockRejectedValue(new Error('MinIO unavailable'));

    await expect(service.uploadPrimaryImage(validImage)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('mengambil binary image dari private bucket untuk diteruskan controller', async () => {
    const body = Readable.from([Buffer.from('image-content')]);
    send.mockResolvedValue({
      Body: body,
      ContentType: 'image/webp',
      ContentLength: 13,
    });
    const fileName = '11111111-1111-1111-1111-111111111111.webp';

    const result = await service.getPrimaryImage(fileName);

    expect(result).toEqual({
      body,
      contentType: 'image/webp',
      contentLength: 13,
    });
    const command = send.mock.calls[0][0] as GetObjectCommand;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'unispace-dev',
      Key: `facility-primary/${fileName}`,
    });
  });

  it('mengembalikan 404 untuk object yang tidak ada', async () => {
    send.mockRejectedValue(
      Object.assign(new Error('not found'), {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      }),
    );

    await expect(
      service.getPrimaryImage('11111111-1111-1111-1111-111111111111.png'),
    ).rejects.toThrow(NotFoundException);
  });
});
