import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { catchError, throwError, type Observable } from 'rxjs';
import { REPORT_ATTACHMENT_LIMITS } from './reports.constants';

const reportFilesInterceptor = FilesInterceptor(
  'photos',
  REPORT_ATTACHMENT_LIMITS.maxCount,
  {
    limits: {
      files: REPORT_ATTACHMENT_LIMITS.maxCount,
      fileSize: REPORT_ATTACHMENT_LIMITS.maxSizeBytes,
    },
  },
);

type UploadError = { code?: string };

/** Menormalkan kegagalan Multer sebelum file berlebih tersimpan di memori. */
export class ReportPhotoUploadInterceptor extends reportFilesInterceptor {
  override async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      const response = await super.intercept(context, next);
      return response.pipe(
        catchError((error: unknown) =>
          throwError(() => this.normalizeUploadError(error)),
        ),
      );
    } catch (error) {
      return throwError(() => this.normalizeUploadError(error));
    }
  }

  private normalizeUploadError(error: unknown) {
    const code =
      typeof error === 'object' && error !== null
        ? (error as UploadError).code
        : undefined;

    if (
      code === 'LIMIT_FILE_SIZE' ||
      error instanceof PayloadTooLargeException
    ) {
      return new PayloadTooLargeException({
        code: 'REPORT_PHOTO_TOO_LARGE',
        message: 'Ukuran setiap foto laporan maksimal 5 MB.',
      });
    }
    if (code === 'LIMIT_FILE_COUNT') {
      return new BadRequestException({
        code: 'REPORT_PHOTO_LIMIT_EXCEEDED',
        message: 'Laporan menerima maksimal 3 foto.',
      });
    }
    if (code === 'LIMIT_UNEXPECTED_FILE') {
      return new BadRequestException({
        code: 'INVALID_REPORT_PHOTO_FIELD',
        message: 'Gunakan field photos untuk foto laporan.',
      });
    }
    return error;
  }
}
