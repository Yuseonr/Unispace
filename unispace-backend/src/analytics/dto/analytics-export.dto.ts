import { IsEnum, IsOptional } from 'class-validator';
import { AnalyticsFilterDto } from './analytics-filter.dto';
import {
  AnalyticsTrendInterval,
  AnalyticsTrendMetric,
} from './analytics-trend.dto';

export enum AnalyticsExportReport {
  SUMMARY = 'summary',
  OCCUPANCY = 'occupancy',
  EQUIPMENT_UTILIZATION = 'equipment-utilization',
  DAMAGE_FREQUENCY = 'damage-frequency',
  TRENDS = 'trends',
  FACILITY_REPORT_HISTORY = 'facility-report-history',
  AUDIT_LOG = 'audit-log',
}

export enum AnalyticsExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export enum AnalyticsExportOrientation {
  PORTRAIT = 'portrait',
  LANDSCAPE = 'landscape',
}

export class AnalyticsExportDto extends AnalyticsFilterDto {
  @IsEnum(AnalyticsExportReport)
  report: AnalyticsExportReport;

  @IsEnum(AnalyticsExportFormat)
  format: AnalyticsExportFormat;

  @IsOptional()
  @IsEnum(AnalyticsExportOrientation)
  orientation?: AnalyticsExportOrientation;

  @IsOptional()
  @IsEnum(AnalyticsTrendMetric)
  metric?: AnalyticsTrendMetric;

  @IsOptional()
  @IsEnum(AnalyticsTrendInterval)
  interval?: AnalyticsTrendInterval;
}
