import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ReservationMode } from '../../generated/prisma/client';

const toTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toOptionalTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

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

  /**
   * Foto utama wajib diunggah/diisi (FR-FAC-06 & FR-FAC-08)
   */
  @Transform(toTrimmedString)
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'primaryImageUrl harus berupa URL yang valid' })
  primaryImageUrl!: string;

  /**
   * Khusus mode EXCLUSIVE: kode aset unit fisik awal yang dibuat bersama grup.
   * Contoh: R-LAB-01
   */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(64)
  assetCode?: string;
}
