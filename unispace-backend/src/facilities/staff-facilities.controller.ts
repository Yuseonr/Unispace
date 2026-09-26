import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import { ListStaffMaintenanceDto } from './dto/staff/list-staff-maintenance.dto';
import { StaffFacilitiesService } from './staff-facilities.service';

@Controller('staff/facilities')
@Roles(UserRole.STAFF)
export class StaffFacilitiesController {
  constructor(private readonly staffFacilities: StaffFacilitiesService) {}

  @Get('maintenance')
  listMaintenance(@Query() query: ListStaffMaintenanceDto) {
    return this.staffFacilities.listMaintenance(query);
  }
}
