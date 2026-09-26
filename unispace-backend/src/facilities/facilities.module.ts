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
import { QuantityReservationReconciliationService } from './quantity-reservation-reconciliation.service';
import { StaffFacilitiesController } from './staff-facilities.controller';
import { StaffFacilitiesService } from './staff-facilities.service';

@Module({
  imports: [MulterModule.register({})],
  controllers: [
    FacilitiesController,
    FacilityImagesController,
    AdminFacilitiesController,
    StaffFacilitiesController,
  ],
  providers: [
    FacilityCatalogService,
    FacilityAvailabilityService,
    FacilityMasterService,
    FacilityManagementService,
    FacilityStatusService,
    FacilityImageStorageService,
    QuantityReservationReconciliationService,
    StaffFacilitiesService,
  ],
  exports: [
    FacilityAvailabilityService,
    QuantityReservationReconciliationService,
  ],
})
export class FacilitiesModule {}
