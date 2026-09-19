import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const normalizeNote = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class ResolveReportDto {
  @Transform(normalizeNote)
  @IsString()
  @IsNotEmpty({ message: 'resolutionNote is required' })
  @MaxLength(5_000)
  resolutionNote: string;
}