import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MaintenanceWindowDto } from './maintenance-window.dto';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDirectMaintenanceDto extends MaintenanceWindowDto {
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;

  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'cancellationReason is required.' })
  @MaxLength(500)
  cancellationReason!: string;

  @IsDefined({ message: 'cancelImpactedReservations is required.' })
  @IsBoolean()
  cancelImpactedReservations!: boolean;
}
