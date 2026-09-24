import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import { ListStaffReservationsDto } from './dto/list-staff-reservations.dto';
import { ReservationsService } from './reservations.service';

@Roles(UserRole.STAFF, UserRole.ADMIN)
@Controller('staff/reservations')
export class StaffReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  /**
   * GET /api/v1/staff/reservations
   * Mengambil daftar antrean permohonan reservasi untuk petugas dan admin (FR-RES-05).
   * Mendukung paginasi, filter status, tanggal, area fasilitas, dan pencarian nama.
   * Mengurutkan berdasarkan urgensi batas waktu SLA (decisionDeadline asc) saat status PENDING.
   */
  @Get()
  list(@Query() query: ListStaffReservationsDto) {
    return this.reservations.listStaff(query);
  }

  /**
   * GET /api/v1/staff/reservations/:id
   * Mengambil rincian lengkap satu permohonan reservasi untuk petugas dan admin (FR-RES-05).
   */
  @Get(':id')
  getDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.getStaffDetail(id);
  }
}
