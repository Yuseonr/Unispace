import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { MaintenanceWindowDto } from './maintenance-window.dto';

export class CreateMaintenancePeriodDto extends MaintenanceWindowDto {
  @IsBoolean()
  cancelImpactedReservations!: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1_000)
  cancellationReason?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(5_000)
  note?: string;
}
