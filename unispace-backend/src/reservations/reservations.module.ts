import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { StaffReservationsController } from './staff-reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [ReservationsController, StaffReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
