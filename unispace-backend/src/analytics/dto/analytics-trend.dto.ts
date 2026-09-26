import { IsEnum } from 'class-validator';
import { AnalyticsFilterDto } from './analytics-filter.dto';

export enum AnalyticsTrendMetric {
  OCCUPANCY = 'occupancy',
  EQUIPMENT_UTILIZATION = 'equipment-utilization',
  DAMAGE_FREQUENCY = 'damage-frequency',
}

export enum AnalyticsTrendInterval {
  DAY = 'day',
  MONTH = 'month',
}

export class AnalyticsTrendDto extends AnalyticsFilterDto {
  @IsEnum(AnalyticsTrendMetric)
  metric: AnalyticsTrendMetric;

  @IsEnum(AnalyticsTrendInterval)
  interval: AnalyticsTrendInterval;
}
