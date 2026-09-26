import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import { AnalyticsQueryService } from './analytics-query.service';
import { AnalyticsExportService } from './analytics-export.service';
import { CurrentUser } from '../accounts/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';
import {
  AnalyticsExportDto,
  AnalyticsFilterDto,
  AnalyticsTrendDto,
  FacilityReportHistoryDto,
} from './dto';

@Controller('admin/analytics')
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsQueryService,
    private readonly exports: AnalyticsExportService,
  ) {}

  @Get('summary')
  summary(@Query() query: AnalyticsFilterDto) {
    return this.analytics.summary(query);
  }

  @Get('occupancy')
  occupancy(@Query() query: AnalyticsFilterDto) {
    return this.analytics.occupancy(query);
  }

  @Get('equipment-utilization')
  equipmentUtilization(@Query() query: AnalyticsFilterDto) {
    return this.analytics.equipmentUtilization(query);
  }

  @Get('damage-frequency')
  damageFrequency(@Query() query: AnalyticsFilterDto) {
    return this.analytics.damageFrequency(query);
  }

  @Get('trends')
  trends(@Query() query: AnalyticsTrendDto) {
    return this.analytics.trends(query);
  }

  @Get('facility-report-history')
  facilityReportHistory(@Query() query: FacilityReportHistoryDto) {
    return this.analytics.facilityReportHistory(query);
  }

  @Get('export')
  async export(
    @CurrentUser() admin: AuthenticatedUser,
    @Query() query: AnalyticsExportDto,
    @Res() response: Response,
  ) {
    const file = await this.exports.generate(admin.id, query);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.end(file.body);
  }
}
