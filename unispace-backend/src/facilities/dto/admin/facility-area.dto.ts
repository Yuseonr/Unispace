import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FacilityAreaStatus } from '../../../generated/prisma/client';

const normalizeCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const normalizeName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/** Payload POST: seluruh identitas area harus tersedia. */
export class CreateFacilityAreaDto {
  @Transform(normalizeCode)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]{2,30}$/, {
    message: 'code hanya boleh berisi huruf kapital, angka, atau underscore',
  })
  code!: string;

  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

/** Payload PATCH: admin dapat mengubah satu atau kedua field area. */
export class UpdateFacilityAreaDto {
  @IsOptional()
  @Transform(normalizeCode)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]{2,30}$/, {
    message: 'code hanya boleh berisi huruf kapital, angka, atau underscore',
  })
  code?: string;

  @IsOptional()
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
}

/** Status dipisahkan dari metadata agar lifecycle area eksplisit di API. */
export class UpdateFacilityAreaStatusDto {
  @IsEnum(FacilityAreaStatus, {
    message: 'status harus berupa ACTIVE atau NONACTIVE',
  })
  status!: FacilityAreaStatus;
}
