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
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Public } from '../accounts/auth/decorators/public.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { GetAvailabilityDto } from './dto/get-availability.dto';
import { ListMyReservationsDto } from './dto/list-my-reservations.dto';
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
   * GET /api/v1/reservations/my
   * Melihat daftar riwayat permohonan reservasi milik pengguna yang sedang login (FR-RES-04).
   */
  @Roles(UserRole.USER)
  @Get('my')
  listMy(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyReservationsDto,
  ) {
    return this.reservations.listMy(user.id, query);
  }

  /**
   * GET /api/v1/reservations/my/:id
   * Melihat rincian lengkap satu permohonan reservasi milik pengguna (FR-RES-04).
   */
  @Roles(UserRole.USER)
  @Get('my/:id')
  getMyDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.reservations.getMyDetail(user.id, id);
  }

  /**
   * GET /api/v1/reservations/:id
   * Alias untuk melihat detail reservasi milik pengguna.
   */
  @Roles(UserRole.USER)
  @Get(':id')
  getDetailAlias(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.reservations.getMyDetail(user.id, id);
  }

  /**
   * PATCH /api/v1/reservations/my/:id/cancel
   * Membatalkan permohonan reservasi mandiri oleh pengguna (FR-RES-06).
   */
  @Roles(UserRole.USER)
  @Patch('my/:id/cancel')
  cancelMy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.reservations.cancelMy(user.id, id);
  }

  /**
   * PATCH /api/v1/reservations/:id/cancel
   * Alias untuk pembatalan mandiri reservasi milik pengguna.
   */
  @Roles(UserRole.USER)
  @Patch(':id/cancel')
  cancelMyAlias(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.reservations.cancelMy(user.id, id);
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
