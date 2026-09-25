import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationStatus } from '../../generated/prisma/client';

export class ListStaffReservationsDto {
  @IsOptional()
  @IsEnum(ReservationStatus, {
    message:
      'Status harus salah satu dari: PENDING, APPROVED, REJECTED, CANCELLED_BY_USER, CANCELLED_BY_STAFF, CANCELLED_BY_SYSTEM, COMPLETED.',
  })
  status?: ReservationStatus;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'Format tanggal pemakaian harus YYYY-MM-DD.' },
  )
  usageDate?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID fasilitas harus berupa UUID v4 yang valid.' })
  facilityId?: string;

  @IsOptional()
  @IsUUID('4', {
    message: 'ID kelompok fasilitas harus berupa UUID v4 yang valid.',
  })
  facilityGroupId?: string;

  @IsOptional()
  @IsUUID('4', {
    message: 'ID area gedung harus berupa UUID v4 yang valid.',
  })
  facilityAreaId?: string;

  @IsOptional()
  @Type(() => String)
  @IsString({ message: 'Kata kunci pencarian harus berupa teks.' })
  @MaxLength(320, {
    message: 'Kata kunci pencarian maksimal 320 karakter.',
  })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Halaman (page) harus berupa bilangan bulat.' })
  @Min(1, { message: 'Halaman (page) minimal bernilai 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Batas (limit) harus berupa bilangan bulat.' })
  @Min(1, { message: 'Batas (limit) minimal bernilai 1.' })
  @Max(100, { message: 'Batas (limit) maksimal bernilai 100.' })
  limit?: number = 10;
}
