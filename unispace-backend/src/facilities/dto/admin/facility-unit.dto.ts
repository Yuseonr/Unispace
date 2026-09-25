import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { FacilityStatus } from '../../../generated/prisma/client';

const toTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toOptionalTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

export class CreateFacilityUnitDto {
  @IsUUID()
  facilityGroupId!: string;

  /** Kode aset fisik unik, misalnya PRJ-001 atau LAB-001. */
  @Transform(toTrimmedString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  assetCode!: string;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(150)
  name?: string;
}

export class UpdateFacilityUnitDto {
  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  assetCode?: string;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  description?: string;
}

/** Lifecycle unit terpisah agar tidak tercampur dengan pembaruan metadata. */
export class UpdateFacilityStatusDto {
  @IsIn([FacilityStatus.ACTIVE, FacilityStatus.NONACTIVE], {
    message: 'status harus berupa ACTIVE atau NONACTIVE',
  })
  status!: FacilityStatus;
}
