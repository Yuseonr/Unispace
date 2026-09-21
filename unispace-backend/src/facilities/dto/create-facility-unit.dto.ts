import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const toTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toOptionalTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateFacilityUnitDto {
  @IsUUID()
  facilityGroupId!: string;

  /**
   * Kode aset fisik unik (misal: PRJ-001, LAB-001)
   */
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
