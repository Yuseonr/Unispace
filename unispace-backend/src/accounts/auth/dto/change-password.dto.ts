import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @MaxLength(24)
  @Matches(/\S/, {
    message: 'newPassword must contain at least one non-whitespace character',
  })
  newPassword: string;
}
