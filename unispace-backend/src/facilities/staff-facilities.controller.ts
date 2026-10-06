import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { ListStaffMaintenanceDto } from './dto/staff/list-staff-maintenance.dto';
import { CreateDirectMaintenanceDto } from './dto/create-direct-maintenance.dto';
import { PreviewDirectMaintenanceDto } from './dto/preview-direct-maintenance.dto';
import { StaffFacilitiesService } from './staff-facilities.service';
import { StaffMaintenanceService } from './staff-maintenance.service';

@Controller('staff/facilities')
@Roles(UserRole.STAFF)
export class StaffFacilitiesController {
  constructor(
    private readonly staffFacilities: StaffFacilitiesService,
    private readonly staffMaintenance: StaffMaintenanceService,
  ) {}

  @Get('maintenance')
  listMaintenance(@Query() query: ListStaffMaintenanceDto) {
    return this.staffFacilities.listMaintenance(query);
  }

  @Post(':facilityId/maintenance/preview')
  previewMaintenance(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: PreviewDirectMaintenanceDto,
  ) {
    return this.staffMaintenance.previewDirectMaintenance(facilityId, dto);
  }

  @Post(':facilityId/maintenance')
  createMaintenance(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: CreateDirectMaintenanceDto,
    @CurrentUser() staff: AuthenticatedUser,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    return this.staffMaintenance.createDirectMaintenance(
      staff.id,
      facilityId,
      dto,
      idempotencyKey,
    );
  }
}
