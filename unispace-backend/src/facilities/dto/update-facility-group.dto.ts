import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const toOptionalTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

export class UpdateFacilityGroupDto {
  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsUUID()
  facilityTypeId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @IsUrl({}, { message: 'primaryImageUrl harus berupa URL yang valid' })
  primaryImageUrl?: string;
}
