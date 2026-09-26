import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
import { ListReportableFacilitiesDto } from './dto/list-reportable-facilities.dto';
import { ReportPhotoUploadInterceptor } from './report-photo-upload.interceptor';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(UserRole.USER)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * POST /api/v1/reports
   * Membuat laporan kerusakan/masalah baru oleh pengguna (FR-REP-01 s.d. FR-REP-04).
   * - Memilih fasilitas fisik (unit aset untuk alat bergerak) melalui storage: facilityId.
   * - Wajib menyertakan 1–3 foto JPEG/PNG/WebP ≤ 5 MB (multipart field "photos").
   * - Fasilitas yang berstatus NONACTIVE tidak dapat dipilih untuk laporan baru.
   * - Laporan dibuat dengan status NEW dan seluruh aksi tercatat pada AUDIT_LOG.
   */
  @Post()
  @UseInterceptors(ReportPhotoUploadInterceptor)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateReportDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (files.length < 1) {
      throw new BadRequestException({
        code: 'REPORT_PHOTO_REQUIRED',
        message: 'Unggah minimal satu foto laporan.',
      });
    }
    return this.reports.create(user.id, input, files, idempotencyKey);
  }

  /**
   * Unit fisik yang dapat dipilih USER sebagai target laporan. Alat QUANTITY
   * selalu dikembalikan per assetCode supaya laporan tidak ambigu.
   */
  @Get('reportable-facilities')
  listReportableFacilities(@Query() query: ListReportableFacilitiesDto) {
    return this.reports.listReportableFacilities(query);
  }

  /** Streaming attachment report dari bucket private setelah cek akses. */
  @Get(':reportId/attachments/:attachmentId')
  @Roles(UserRole.USER, UserRole.STAFF)
  async downloadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Res() response: Response,
  ) {
    const attachment = await this.reports.getAttachmentForViewer(
      user,
      reportId,
      attachmentId,
    );
    const safeName = encodeURIComponent(
      attachment.originalFilename.replace(/[\\/\r\n]/g, '_').slice(0, 180),
    );
    response.setHeader('Content-Type', attachment.contentType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${safeName}`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (attachment.contentLength !== undefined) {
      response.setHeader('Content-Length', attachment.contentLength.toString());
    }
    await pipeline(attachment.body, response);
  }

  /**
   * GET /api/v1/reports/me
   * Daftar laporan milik pengguna dengan filter status, fasilitas, dan rentang tanggal (FR-REP-05).
   */
  @Get('me')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyReportsDto,
  ) {
    return this.reports.listMine(user.id, query);
  }

  /**
   * GET /api/v1/reports/me/:reportId
   * Detail satu laporan milik pengguna (FR-REP-05).
   * Menampilkan alasan keputusan (decisionReason) dan catatan resolusi (resolutionNote)
   * yang boleh dibagikan petugas kepada pelapor.
   */
  @Get('me/:reportId')
  detailMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
  ) {
    return this.reports.detailMine(user.id, reportId);
  }
}
