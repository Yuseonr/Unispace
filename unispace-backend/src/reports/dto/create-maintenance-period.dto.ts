import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MaintenanceMode } from '../reports.constants';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateMaintenancePeriodDto {
  @IsEnum(MaintenanceMode)
  mode: MaintenanceMode;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(trimValue)
  @Matches(/^([01]\d|20):[0-5]\d$/)
  startTime?: string;

  @IsOptional()
  @Transform(trimValue)
  @Matches(/^([01]\d|20):[0-5]\d$/)
  endTime?: string;

  @IsBoolean()
  cancelImpactedReservations: boolean;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(1_000)
  cancellationReason?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(5_000)
  note?: string;
}