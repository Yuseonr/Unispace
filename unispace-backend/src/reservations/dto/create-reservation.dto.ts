import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReservationDto {
  @IsOptional()
  @IsUUID('4', { message: 'facilityId must be a valid UUID' })
  facilityId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'facilityGroupId must be a valid UUID' })
  facilityGroupId?: string;

  @IsOptional()
  @IsInt({ message: 'requestedQuantity must be an integer' })
  @Min(1, { message: 'requestedQuantity must be at least 1' })
  requestedQuantity?: number = 1;

  @Transform(trimValue)
  @IsNotEmpty({ message: 'usageDate is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'usageDate must be in YYYY-MM-DD format',
  })
  @IsISO8601(
    { strict: true },
    { message: 'usageDate must be a valid calendar date' },
  )
  usageDate: string;

  @Transform(trimValue)
  @IsNotEmpty({ message: 'startTime is required' })
  @Matches(/^([01]\d|20):[0-5]\d$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @Transform(trimValue)
  @IsNotEmpty({ message: 'endTime is required' })
  @Matches(/^([01]\d|20):[0-5]\d$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @Transform(trimValue)
  @IsDefined({ message: 'purpose is required' })
  @IsString({ message: 'purpose must be a string' })
  @IsNotEmpty({ message: 'purpose must not be blank' })
  @MaxLength(500, { message: 'purpose must not exceed 500 characters' })
  purpose!: string;
}
