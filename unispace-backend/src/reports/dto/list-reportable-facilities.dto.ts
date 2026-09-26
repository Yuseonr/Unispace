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

/** Filter aman untuk pemilihan unit fisik pada formulir laporan pengguna. */
export class ListReportableFacilitiesDto {
  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  facilityGroupId?: string;

  @IsOptional()
  @IsUUID('4')
  facilityAreaId?: string;

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
