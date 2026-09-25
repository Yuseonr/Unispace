import { Module } from '@nestjs/common';
import { FacilitiesModule } from '../facilities/facilities.module';
import { ReservationsController } from './reservations.controller';
import { StaffReservationsController } from './staff-reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationsScheduler } from './reservations.scheduler';

@Module({
  imports: [FacilitiesModule],
  controllers: [ReservationsController, StaffReservationsController],
  providers: [ReservationsService, ReservationsScheduler],
})
export class ReservationsModule {}
