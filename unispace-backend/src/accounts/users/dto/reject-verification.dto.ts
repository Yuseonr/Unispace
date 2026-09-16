import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

const normalizeSpaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class RejectVerificationDto {
  @Transform(normalizeSpaces)
  @IsString()
  @MaxLength(1_000)
  @Matches(/\S/, { message: 'reason must not be blank' })
  reason: string;
}
