import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
