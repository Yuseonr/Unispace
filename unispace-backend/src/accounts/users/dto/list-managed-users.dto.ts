import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AccountStatus, UserRole } from '../../../generated/prisma/client';

const MANAGEABLE_ROLES = [UserRole.USER, UserRole.STAFF] as const;

const toOptionalTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

export class ListManagedUsersDto {
  @IsOptional()
  @IsIn(MANAGEABLE_ROLES)
  role?: (typeof MANAGEABLE_ROLES)[number];

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(320)
  search?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
