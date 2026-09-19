import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ReportCategory } from '../../generated/prisma/client';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReportDto {
  @Transform(trimValue)
  @IsUUID('4', { message: 'facilityId must be a valid UUID' })
  facilityId: string;

  @IsEnum(ReportCategory, { message: 'category is invalid' })
  category: ReportCategory;

  @Transform(trimValue)
  @IsString({ message: 'description must be a string' })
  @IsNotEmpty({ message: 'description is required' })
  @MaxLength(5_000, { message: 'description must not exceed 5000 characters' })
  description: string;
}