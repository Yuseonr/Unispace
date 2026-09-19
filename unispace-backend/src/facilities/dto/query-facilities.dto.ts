import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

const toOptionalTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class QueryFacilitiesDto {
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
  minCapacity?: number;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
