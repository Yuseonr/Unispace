import { BadRequestException } from '@nestjs/common';

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type SupportedImageMimeType =
  (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export type ImageUploadLike = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

export type DetectedImage = {
  mimeType: SupportedImageMimeType;
  extension: 'jpg' | 'png' | 'webp';
};

function startsWith(buffer: Buffer, signature: readonly number[]) {
  return (
    buffer.length >= signature.length &&
    signature.every((value, index) => buffer[index] === value)
  );
}

/**
 * Mendeteksi format dari signature berkas, bukan dari nama atau MIME header
 * client. Tiga format yang diizinkan tidak membutuhkan parser image penuh.
 */
export function detectImage(buffer: Buffer): DetectedImage | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}

export function validateImageUpload(
  file: ImageUploadLike | undefined,
  options: {
    maxSizeBytes: number;
    requiredCode: string;
    requiredMessage: string;
    unsupportedCode: string;
    unsupportedMessage: string;
    invalidSizeCode: string;
    invalidSizeMessage: string;
    invalidContentCode: string;
    invalidContentMessage: string;
  },
): DetectedImage {
  if (!file) {
    throw new BadRequestException({
      code: options.requiredCode,
      message: options.requiredMessage,
    });
  }

  if (
    !SUPPORTED_IMAGE_MIME_TYPES.includes(
      file.mimetype as SupportedImageMimeType,
    )
  ) {
    throw new BadRequestException({
      code: options.unsupportedCode,
      message: options.unsupportedMessage,
    });
  }

  if (!file.buffer || file.size <= 0 || file.size > options.maxSizeBytes) {
    throw new BadRequestException({
      code: options.invalidSizeCode,
      message: options.invalidSizeMessage,
    });
  }

  const detected = detectImage(file.buffer);
  if (!detected || detected.mimeType !== file.mimetype) {
    throw new BadRequestException({
      code: options.invalidContentCode,
      message: options.invalidContentMessage,
    });
  }

  return detected;
}
