import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(UserRole.USER)
export class ReportsController {
	constructor(private readonly reports: ReportsService) {}

	@Post()
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Body() input: CreateReportDto,
	) {
		return this.reports.create(user.id, input);
	}

	@Get('me')
	listMine(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: ListMyReportsDto,
	) {
		return this.reports.listMine(user.id, query);
	}

	@Get('me/:reportId')
	detailMine(
		@CurrentUser() user: AuthenticatedUser,
		@Param('reportId', new ParseUUIDPipe()) reportId: string,
	) {
		return this.reports.detailMine(user.id, reportId);
	}
}
