import { Module } from '@nestjs/common';
import { ObjectStorageService } from '../common/storage/object-storage.service';
import { FacilitiesModule } from '../facilities/facilities.module';
import { ReportsController } from './reports.controller';
import { StaffReportsController } from './staff-reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [FacilitiesModule],
  controllers: [ReportsController, StaffReportsController],
  providers: [ReportsService, ObjectStorageService],
})
export class ReportsModule {}
