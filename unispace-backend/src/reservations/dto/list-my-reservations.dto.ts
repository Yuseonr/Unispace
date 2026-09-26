import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsIn,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ReservationStatus } from '../../generated/prisma/client';

const toOptionalTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

export class ListMyReservationsDto {
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  /** Riwayat terminal tanpa mengirim beberapa status enum melalui query. */
  @IsOptional()
  @IsIn(['HISTORY'])
  view?: 'HISTORY';

  @IsOptional()
  @Transform(toOptionalTrimmedString)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'usageDate must be in YYYY-MM-DD format',
  })
  @IsISO8601(
    { strict: true },
    { message: 'usageDate must be a valid calendar date' },
  )
  usageDate?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}
