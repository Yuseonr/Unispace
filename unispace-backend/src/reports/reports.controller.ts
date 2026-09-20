import {
	Body,
	BadRequestException,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import { CreateReportDto } from './dto/create-report.dto';
import { ListMyReportsDto } from './dto/list-my-reports.dto';
import { REPORT_ATTACHMENT_LIMITS } from './reports.constants';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(UserRole.USER)
export class ReportsController {
	constructor(private readonly reports: ReportsService) {}

	@Post()
	@UseInterceptors(FilesInterceptor('photos', REPORT_ATTACHMENT_LIMITS.maxCount))
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Body() input: CreateReportDto,
		@UploadedFiles() files: Express.Multer.File[] = [],
	) {
		if (
			files.length < 1 ||
			files.length > REPORT_ATTACHMENT_LIMITS.maxCount ||
			files.some(
				(file) =>
					!REPORT_ATTACHMENT_LIMITS.allowedMimeTypes.includes(
						file.mimetype as (typeof REPORT_ATTACHMENT_LIMITS.allowedMimeTypes)[number],
					) || file.size > REPORT_ATTACHMENT_LIMITS.maxSizeBytes,
			)
		) {
			throw new BadRequestException({
				code: 'INVALID_REPORT_PHOTOS',
				message: 'Upload 1 to 3 JPEG, PNG, or WebP photos up to 5 MB each.',
			});
		}
		return this.reports.create(user.id, input, files);
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
