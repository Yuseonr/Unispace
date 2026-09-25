import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { ApproveReservationDto } from './dto/approve-reservation.dto';
import { RejectReservationDto } from './dto/reject-reservation.dto';
import { CancelStaffReservationDto } from './dto/cancel-staff-reservation.dto';
import { ListStaffReservationsDto } from './dto/list-staff-reservations.dto';
import { ReservationsService } from './reservations.service';

@Roles(UserRole.STAFF)
@Controller('staff/reservations')
export class StaffReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  /**
   * GET /api/v1/staff/reservations
   * Mengambil daftar antrean permohonan reservasi untuk petugas (FR-RES-05).
   * Mendukung paginasi, filter status, tanggal, area fasilitas, dan pencarian nama.
   * Mengurutkan berdasarkan urgensi batas waktu SLA (decisionDeadline asc) saat status PENDING.
   */
  @Get()
  list(@Query() query: ListStaffReservationsDto) {
    return this.reservations.listStaff(query);
  }

  /**
   * GET /api/v1/staff/reservations/:id
   * Mengambil rincian lengkap satu permohonan reservasi untuk petugas (FR-RES-05).
   */
  @Get(':id')
  getDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.getStaffDetail(id);
  }

  /**
   * PATCH /api/v1/staff/reservations/:id/approve
   * Menyetujui permohonan reservasi secara atomik oleh petugas (FR-RES-04 & FR-RES-05).
   * - Untuk Ruang (EXCLUSIVE): mengunci slot & cascade auto-reject pengajuan PENDING yang bentrok.
   * - Untuk Kelompok Alat (QUANTITY): backend memilih dan mengalokasikan unit aset fisik yang bebas,
   *   lalu cascade auto-reject pengajuan PENDING yang kekurangan stok.
   */
  @Patch(':id/approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveReservationDto,
  ) {
    return this.reservations.approve(user.id, id, dto);
  }

  /**
   * PATCH /api/v1/staff/reservations/:id/reject
   * Menolak permohonan reservasi berstatus PENDING oleh petugas dengan alasan wajib (FR-RES-05 & RULE-RES-04).
   */
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectReservationDto,
  ) {
    return this.reservations.reject(user.id, id, dto);
  }

  /**
   * PATCH /api/v1/staff/reservations/:id/cancel
   * Membatalkan permohonan reservasi aktif (PENDING atau APPROVED) oleh petugas dengan alasan wajib (FR-RES-07).
   */
  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelStaffReservationDto,
  ) {
    return this.reservations.cancelByStaff(user.id, id, dto);
  }

  /**
   * POST /api/v1/staff/reservations/auto-reject-expired
   * Memicu evaluasi dan penolakan otomatis reservasi PENDING yang melewati batas SLA (FR-RES-08 & RULE-RES-04).
   */
  @Post('auto-reject-expired')
  async autoRejectExpired() {
    const processedCount =
      await this.reservations.autoRejectExpiredReservations();
    return {
      success: true,
      processedCount,
      message: `Berhasil mengevaluasi dan menolak otomatis ${processedCount} permohonan reservasi yang melewati batas SLA.`,
    };
  }
}
