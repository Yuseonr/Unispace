import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ReservationMode } from '../../../generated/prisma/client';

const toTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toOptionalTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

/** Payload POST: membentuk identitas dan aturan reservasi sebuah kelompok. */
export class CreateFacilityGroupDto {
  @Transform(toTrimmedString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsUUID()
  facilityTypeId!: string;

  @IsEnum(ReservationMode)
  reservationMode!: ReservationMode;

  @IsUUID()
  facilityAreaId!: string;

  @Transform(toTrimmedString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  locationDetail!: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  description?: string;

  /**
   * Khusus EXCLUSIVE: kode aset unit fisik awal yang dibuat bersama grup.
   * Contoh: R-LAB-01.
   */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(64)
  assetCode?: string;
}

/** Payload PATCH: reservationMode sengaja immutable setelah grup dibuat. */
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
  facilityAreaId?: string;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(500)
  locationDetail?: string;

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
