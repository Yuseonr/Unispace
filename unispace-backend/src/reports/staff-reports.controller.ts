import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
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
import { ConfirmMaintenancePeriodDto } from './dto/confirm-maintenance-period.dto';
import { PreviewMaintenanceImpactDto } from './dto/preview-maintenance-impact.dto';
import { ReportsService } from './reports.service';

@Controller('staff/reports')
@Roles(UserRole.STAFF)
export class StaffReportsController {
	constructor(private readonly reports: ReportsService) {}

	@Get()
	list(@Query() query: ListStaffReportsDto) {
		return this.reports.listStaff(query);
	}

	@Post(':reportId/maintenance/preview')
	previewMaintenanceImpact(
		@Param('reportId', new ParseUUIDPipe()) reportId: string,
		@Body() dto: PreviewMaintenanceImpactDto,
	) {
		return this.reports.previewReportMaintenanceImpact(
			reportId,
			new Date(dto.startAt),
			new Date(dto.endAt),
		);
	}

	@Post(':reportId/maintenance')
	confirmMaintenancePeriod(
		@CurrentUser() user: AuthenticatedUser,
		@Param('reportId', new ParseUUIDPipe()) reportId: string,
		@Body() dto: ConfirmMaintenancePeriodDto,
	) {
		return this.reports.confirmMaintenancePeriod(user.id, reportId, dto);
	}

	@Patch('maintenance/:periodId/end')
	endMaintenancePeriod(
		@CurrentUser() user: AuthenticatedUser,
		@Param('periodId', new ParseUUIDPipe()) periodId: string,
	) {
		return this.reports.endMaintenancePeriod(user.id, periodId, new Date());
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