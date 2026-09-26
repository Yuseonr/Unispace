import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { ReservationMode } from '../../generated/prisma/client';

const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** Filter yang dipakai seluruh rekap, grafik, riwayat, dan export. */
export class AnalyticsFilterDto {
  @Transform(trimOptional)
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom: string;

  @Transform(trimOptional)
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo: string;

  @IsOptional()
  @IsUUID('4')
  facilityAreaId?: string;

  @IsOptional()
  @IsUUID('4')
  facilityTypeId?: string;

  @IsOptional()
  @IsUUID('4')
  facilityGroupId?: string;

  @IsOptional()
  @IsUUID('4')
  facilityId?: string;

  @IsOptional()
  @IsEnum(ReservationMode)
  reservationMode?: ReservationMode;
}
