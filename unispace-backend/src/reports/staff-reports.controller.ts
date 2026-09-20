import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import { ListStaffReportsDto } from './dto/list-staff-reports.dto';
import { ReportsService } from './reports.service';

@Controller('staff/reports')
@Roles(UserRole.STAFF)
export class StaffReportsController {
	constructor(private readonly reports: ReportsService) {}

	@Get()
	list(@Query() query: ListStaffReportsDto) {
		return this.reports.listStaff(query);
	}
}