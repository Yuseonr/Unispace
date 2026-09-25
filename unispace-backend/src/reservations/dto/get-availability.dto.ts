import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class GetAvailabilityDto {
  @IsOptional()
  @IsUUID('4', { message: 'facilityId must be a valid UUID' })
  facilityId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'facilityGroupId must be a valid UUID' })
  facilityGroupId?: string;

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
}
