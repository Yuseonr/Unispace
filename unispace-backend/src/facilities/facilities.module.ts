import { Module } from '@nestjs/common';
import { AdminFacilitiesController } from './admin-facilities.controller';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';

@Module({
  controllers: [FacilitiesController, AdminFacilitiesController],
  providers: [FacilitiesService],
})
export class FacilitiesModule {}
