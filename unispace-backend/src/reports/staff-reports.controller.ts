import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { RejectReportDto } from './dto/reject-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ListStaffReportsDto } from './dto/list-staff-reports.dto';
import { ListReportAuditDto } from './dto/list-report-audit.dto';
import { ReportsService } from './reports.service';

@Controller('staff/reports')
@Roles(UserRole.STAFF)
export class StaffReportsController {
	constructor(private readonly reports: ReportsService) {}

	@Get()
	list(@Query() query: ListStaffReportsDto) {
		return this.reports.listStaff(query);
	}

	@Get(':reportId')
	detail(
		@Param('reportId', new ParseUUIDPipe()) reportId: string,
	) {
		return this.reports.detailStaff(reportId);
	}

	@Get(':reportId/audit')
	@Roles(UserRole.STAFF, UserRole.ADMIN)
	audit(
		@Param('reportId', new ParseUUIDPipe()) reportId: string,
		@Query() query: ListReportAuditDto,
	) {
		return this.reports.listAudit(reportId, query);
	}

	@Patch(':reportId/accept')
	accept(
		@CurrentUser() user: AuthenticatedUser,
		@Param('reportId', new ParseUUIDPipe()) reportId: string,
	) {
		return this.reports.accept(user.id, reportId);
	}

	@Patch(':reportId/reject')
	reject(
		@CurrentUser() user: AuthenticatedUser,
		@Param('reportId', new ParseUUIDPipe()) reportId: string,
		@Body() dto: RejectReportDto,
	) {
		return this.reports.reject(user.id, reportId, dto.reason);
	}

	@Patch(':reportId/resolve')
	resolve(
		@CurrentUser() user: AuthenticatedUser,
		@Param('reportId', new ParseUUIDPipe()) reportId: string,
		@Body() dto: ResolveReportDto,
	) {
		return this.reports.resolve(user.id, reportId, dto.resolutionNote);
	}
}