import { Module } from '@nestjs/common';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { ReportsController } from './reports.controller';
import { ReportsScheduler } from './reports.scheduler';
import { StaffReportsController } from './staff-reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController, StaffReportsController],
  providers: [ReportsService, ObjectStorageService, ReportsScheduler],
})
export class ReportsModule {}
