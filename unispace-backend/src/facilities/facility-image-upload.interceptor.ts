import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { catchError, throwError, type Observable } from 'rxjs';

const imageFileInterceptor = FileInterceptor('primaryImage', {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

type UploadError = {
  code?: string;
};

/**
 * Mengubah error adapter Multer menjadi error API standar sebelum mencapai
 * controller. Validasi MIME dan ukuran nol tetap berada di storage service.
 */
export class FacilityImageUploadInterceptor extends imageFileInterceptor {
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
        code: 'FACILITY_IMAGE_TOO_LARGE',
        message: 'Ukuran foto fasilitas maksimal 5 MB.',
      });
    }

    if (code === 'LIMIT_UNEXPECTED_FILE') {
      return new BadRequestException({
        code: 'INVALID_FACILITY_IMAGE_FIELD',
        message: 'Gunakan field primaryImage untuk foto fasilitas.',
      });
    }

    return error;
  }
}
