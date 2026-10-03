import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MaintenanceMode } from '../../reports/reports.constants';

export class CreateDirectMaintenanceDto {
  @IsEnum(MaintenanceMode)
  mode: MaintenanceMode;

  @ValidateIf((o) => o.mode === MaintenanceMode.DATE_RANGE)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate harus berformat YYYY-MM-DD',
  })
  startDate?: string;

  @ValidateIf((o) => o.mode === MaintenanceMode.DATE_RANGE)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate harus berformat YYYY-MM-DD',
  })
  endDate?: string;

  @ValidateIf((o) => o.mode === MaintenanceMode.TIME_RANGE)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date harus berformat YYYY-MM-DD',
  })
  date?: string;

  @ValidateIf((o) => o.mode === MaintenanceMode.TIME_RANGE)
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime harus berformat HH:mm',
  })
  startTime?: string;

  @ValidateIf((o) => o.mode === MaintenanceMode.TIME_RANGE)
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime harus berformat HH:mm',
  })
  endTime?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string;

  @IsOptional()
  @IsBoolean()
  cancelImpactedReservations?: boolean;
}
