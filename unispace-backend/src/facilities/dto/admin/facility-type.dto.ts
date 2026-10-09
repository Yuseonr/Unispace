import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FacilityTypeStatus } from '../../../generated/prisma/client';

const normalizeName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class CreateFacilityTypeDto {
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class UpdateFacilityTypeDto {
  @IsOptional()
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}

export class UpdateFacilityTypeStatusDto {
  @IsEnum(FacilityTypeStatus, {
    message: 'status harus berupa ACTIVE atau NONACTIVE',
  })
  status!: FacilityTypeStatus;
}
