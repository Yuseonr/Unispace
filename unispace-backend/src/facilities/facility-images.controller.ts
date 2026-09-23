import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { Public } from '../accounts/auth/decorators/public.decorator';
import { FacilityImageStorageService } from './facility-image-storage.service';

@Controller('facilities/images')
export class FacilityImagesController {
  constructor(private readonly storage: FacilityImageStorageService) {}

  /**
   * Mengalirkan foto dari private bucket tanpa mengekspos kredensial atau URL
   * object storage kepada klien. Respons endpoint ini adalah binary image,
   * sehingga sengaja tidak menggunakan envelope JSON global.
   */
  @Public()
  @Get(':fileName')
  async getPrimaryImage(
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ) {
    const image = await this.storage.getPrimaryImage(fileName);

    response.setHeader('Content-Type', image.contentType);
    response.setHeader('Cache-Control', 'public, max-age=86400');
    if (image.contentLength !== undefined) {
      response.setHeader('Content-Length', image.contentLength.toString());
    }

    await pipeline(image.body, response);
  }
}
