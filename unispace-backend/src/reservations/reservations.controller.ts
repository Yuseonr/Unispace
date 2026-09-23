import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Public } from '../accounts/auth/decorators/public.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { GetAvailabilityDto } from './dto/get-availability.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  /**
   * GET /api/v1/reservations/availability
   * Mengecek ketersediaan 26 slot 30 menit (07.00–20.00 WIB) pada tanggal tertentu.
   * Terbuka untuk publik tanpa membocorkan identitas/tujuan pemesan (FR-FAC-04).
   */
  @Public()
  @Get('availability')
  getAvailability(@Query() query: GetAvailabilityDto) {
    return this.reservations.getAvailability(query);
  }

  /**
   * POST /api/v1/reservations
   * Mengajukan permohonan reservasi fasilitas baru oleh pengguna terautentikasi (FR-RES-01).
   */
  @Roles(UserRole.USER)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservations.create(user.id, dto);
  }
}
