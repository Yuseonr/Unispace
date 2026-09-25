import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportsService } from './reports.service';

@Injectable()
export class ReportsScheduler {
  private readonly logger = new Logger(ReportsScheduler.name);

  constructor(private readonly reports: ReportsService) {}

  /**
   * Sinkronisasi status fasilitas dari periode perbaikan secara terjadwal.
   * Aturan bisnis 31 dan 33:
   * - ketika start_at sebuah periode terlampaui, fasilitas menjadi IN_MAINTENANCE;
   * - ketika end_at terlampaui (atau di-override lebih awal), fasilitas kembali ACTIVE
   *   bila tidak ada periode lain yang masih aktif dan fasilitas tidak NONACTIVE.
   * Metode di service bersifat idempotent, sehingga aman dijalankan berkala.
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'reports-maintenance-sync',
    timeZone: 'Asia/Jakarta',
  })
  async syncEffectiveFacilityStatus() {
    try {
      const result = await this.reports.syncEffectiveFacilityStatuses();
      if (result.facilitiesUpdated > 0) {
        this.logger.log(
          `Automatic maintenance sync updated ${result.facilitiesUpdated} of ${result.facilitiesChecked} facilities.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Automatic maintenance sync failed.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
