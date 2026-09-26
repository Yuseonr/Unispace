import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { FacilitiesModule } from '../facilities/facilities.module';
import { ReportsController } from './reports.controller';
import { StaffReportsController } from './staff-reports.controller';
import { ReportsService } from './reports.service';
import { StaffDashboardController } from './staff-dashboard.controller';
import { StaffDashboardService } from './staff-dashboard.service';

@Module({
  imports: [FacilitiesModule, MulterModule.register({})],
  controllers: [
    ReportsController,
    StaffReportsController,
    StaffDashboardController,
  ],
  providers: [
    ReportsService,
    ObjectStorageService,
    StaffDashboardService,
    IdempotencyService,
  ],
  exports: [ObjectStorageService],
})
export class ReportsModule {}
