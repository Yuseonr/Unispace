import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const normalizeReason = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class RejectReportDto {
  @Transform(normalizeReason)
  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(1_000)
  reason: string;
}
