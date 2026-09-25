import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationsService } from './reservations.service';

/** Menjalankan satu worker SLA reservasi melalui Nest scheduler. */
@Injectable()
export class ReservationsScheduler {
  private readonly logger = new Logger(ReservationsScheduler.name);

  constructor(private readonly reservations: ReservationsService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'reservations-sla-auto-reject',
    timeZone: 'Asia/Jakarta',
  })
  async rejectExpiredReservations() {
    try {
      const rejected = await this.reservations.autoRejectExpiredReservations();
      if (rejected > 0) {
        this.logger.log(
          `Automatically rejected ${rejected} expired reservation request(s).`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Automatic reservation SLA rejection failed.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
