import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../accounts/auth/decorators/public.decorator';
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
}
