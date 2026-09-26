import { Controller, Get } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import { StaffDashboardService } from './staff-dashboard.service';

@Controller('staff/dashboard')
@Roles(UserRole.STAFF)
export class StaffDashboardController {
  constructor(private readonly dashboard: StaffDashboardService) {}

  /** Count antrean resmi untuk dashboard dan badge sidebar petugas. */
  @Get('summary')
  summary() {
    return this.dashboard.summary();
  }
}
