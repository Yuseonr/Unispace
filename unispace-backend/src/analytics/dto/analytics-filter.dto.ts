import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ReservationMode } from '../../generated/prisma/client';

const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** Filter yang dipakai seluruh rekap, grafik, riwayat, dan export. */
export class AnalyticsFilterDto {
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  allTime?: boolean;

  @Transform(trimOptional)
  @ValidateIf((input: AnalyticsFilterDto) => !input.allTime)
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom: string;

  @Transform(trimOptional)
  @ValidateIf((input: AnalyticsFilterDto) => !input.allTime)
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
