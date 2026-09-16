import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const normalizeSpaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
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

  @IsString()
  @MinLength(12)
  @MaxLength(24)
  @Matches(/\S/, {
    message: 'password must contain at least one non-whitespace character',
  })
  password: string;
}
