import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AuditLogService } from './audit-log.service';
import { AnalyticsQueryService } from './analytics-query.service';
import { AnalyticsExportService } from './analytics-export.service';

@Module({
  controllers: [AnalyticsController, AdminAuditLogsController],
  providers: [AnalyticsQueryService, AuditLogService, AnalyticsExportService],
})
export class AnalyticsModule {}
