import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

export class SearchReportFacilitiesDto {
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  search: string;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
