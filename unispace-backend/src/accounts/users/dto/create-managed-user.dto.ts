import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../generated/prisma/client';

const MANAGEABLE_ROLES = [UserRole.USER, UserRole.STAFF] as const;

const normalizeSpaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateManagedUserDto {
  @Transform(normalizeSpaces)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^\p{L}[\p{L}\p{M}' .-]*$/u, {
    message:
      'name may contain letters, spaces, apostrophes, dots, and hyphens only',
  })
  name: string;

  @Transform(trimValue)
  @IsString()
  @Matches(/^\d{8,30}$/, {
    message: 'identityNumber must contain 8 to 30 digits',
  })
  identityNumber: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsIn(MANAGEABLE_ROLES)
  role: (typeof MANAGEABLE_ROLES)[number];
}
