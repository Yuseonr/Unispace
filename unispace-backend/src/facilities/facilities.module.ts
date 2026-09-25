import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AdminFacilitiesController } from './admin-facilities.controller';
import { FacilityManagementService } from './admin/facility-management.service';
import { FacilityMasterService } from './admin/facility-master.service';
import { FacilityStatusService } from './admin/facility-status.service';
import { FacilityAvailabilityService } from './catalog/facility-availability.service';
import { FacilityCatalogService } from './catalog/facility-catalog.service';
import { FacilityImagesController } from './facility-images.controller';
import { FacilityImageStorageService } from './facility-image-storage.service';
import { FacilitiesController } from './facilities.controller';

@Module({
  imports: [MulterModule.register({})],
  controllers: [
    FacilitiesController,
    FacilityImagesController,
    AdminFacilitiesController,
  ],
  providers: [
    FacilityCatalogService,
    FacilityAvailabilityService,
    FacilityMasterService,
    FacilityManagementService,
    FacilityStatusService,
    FacilityImageStorageService,
  ],
  exports: [FacilityAvailabilityService],
})
export class FacilitiesModule {}
