import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { RejectReportDto } from './dto/reject-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ListStaffReportsDto } from './dto/list-staff-reports.dto';
import { ListReportAuditDto } from './dto/list-report-audit.dto';
import { ConfirmMaintenancePeriodDto } from './dto/confirm-maintenance-period.dto';
import { PreviewMaintenanceImpactDto } from './dto/preview-maintenance-impact.dto';
import { ReportsService } from './reports.service';

@Controller('staff/reports')
@Roles(UserRole.STAFF)
export class StaffReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * GET /api/v1/staff/reports
   * Antrean laporan bersama untuk petugas dengan filter status, fasilitas,
   * dan rentang tanggal pembuatan (FR-REP-06, FR-ADM-06).
   */
  @Get()
  list(@Query() query: ListStaffReportsDto) {
    return this.reports.listStaff(query);
  }

  /**
   * POST /api/v1/staff/reports/:reportId/maintenance/preview
   * Pratinjau dampak periode perbaikan terhadap reservasi APPROVED dan PENDING (FR-REP-10, FR-REP-12).
   * Hanya laporan IN_PROGRESS yang dapat membuat periode perbaikan.
   */
  @Post(':reportId/maintenance/preview')
  previewMaintenanceImpact(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: PreviewMaintenanceImpactDto,
  ) {
    return this.reports.previewReportMaintenanceImpact(reportId, dto);
  }

  /**
   * POST /api/v1/staff/reports/:reportId/maintenance
   * Membuat periode perbaikan dari laporan IN_PROGRESS setelah konfirmasi dampak (FR-REP-10, FR-REP-11, FR-REP-12).
   * - Modus DATE_RANGE: rentang tanggal penuh 07.00–20.00 WIB tanpa jam spesifik.
   * - Modus TIME_RANGE: satu tanggal dengan rentang slot kelipatan 30 menit di dalam jam operasional.
   * - Semua reservasi APPROVED terdampak dibatalkan massal dengan satu alasan;
   *   untuk alat QUANTITY hanya PENDING yang tidak lagi cukup pada slot ditolak.
   */
  @Post(':reportId/maintenance')
  confirmMaintenancePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: ConfirmMaintenancePeriodDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    return this.reports.confirmMaintenancePeriod(
      user.id,
      reportId,
      dto,
      idempotencyKey,
    );
  }

  /**
   * PATCH /api/v1/staff/reports/maintenance/:periodId/end
   * Mengakhiri periode perbaikan lebih awal (override end_at ke waktu saat ini) (FR-REP-11).
   * Status efektif fasilitas kembali ACTIVE bila tidak ada periode lain yang masih
   * berlangsung dan fasilitas tidak berstatus NONACTIVE.
   */
  @Patch('maintenance/:periodId/end')
  endMaintenancePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('periodId', new ParseUUIDPipe()) periodId: string,
  ) {
    return this.reports.endMaintenancePeriod(user.id, periodId, new Date());
  }

  /**
   * GET /api/v1/staff/reports/:reportId
   * Detail satu laporan untuk antrean petugas (FR-REP-06, FR-ADM-06).
   */
  @Get(':reportId')
  detail(@Param('reportId', new ParseUUIDPipe()) reportId: string) {
    return this.reports.detailStaff(reportId);
  }

  /**
   * GET /api/v1/staff/reports/:reportId/audit
   * Riwayat audit laporan, periode perbaikan, dan fasilitas yang terkait (FR-ADM-06, FR-ADM-07).
   * Dapat diakses oleh STAFF dan ADMIN.
   */
  @Get(':reportId/audit')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  audit(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Query() query: ListReportAuditDto,
  ) {
    return this.reports.listAudit(reportId, query);
  }

  /**
   * PATCH /api/v1/staff/reports/:reportId/accept
   * Menerima laporan NEW → IN_PROGRESS dalam antrean bersama (FR-REP-07).
   * Petugas pertama yang menerima disimpan pada acceptedBy/acceptedAt;
   * laporan tetap dapat dilanjutkan petugas lain dan setiap aksi tercatat di audit log.
   */
  @Patch(':reportId/accept')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
  ) {
    return this.reports.accept(user.id, reportId);
  }

  /**
   * PATCH /api/v1/staff/reports/:reportId/reject
   * Menolak laporan dengan alasan wajib (FR-REP-08).
   * Alasan tersimpan pada decisionReason dan dapat dilihat pelapor.
   */
  @Patch(':reportId/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: RejectReportDto,
  ) {
    return this.reports.reject(user.id, reportId, dto.reason);
  }

  /**
   * PATCH /api/v1/staff/reports/:reportId/resolve
   * Menyelesaikan laporan dengan catatan resolusi wajib (FR-REP-09).
   * Ditolak selama laporan masih memiliki periode perbaikan aktif atau terjadwal;
   * laporan tetap IN_PROGRESS sampai seluruh periode berakhir atau diakhiri lebih awal.
   */
  @Patch(':reportId/resolve')
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reports.resolve(user.id, reportId, dto.resolutionNote);
  }
}
