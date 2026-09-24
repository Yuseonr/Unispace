import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelStaffReservationDto {
  /**
   * Alasan pembatalan reservasi oleh petugas (wajib diisi, minimal 5 karakter).
   */
  @Transform(({ obj, value }) => {
    const raw =
      typeof value === 'string'
        ? value
        : (obj?.decisionReason ?? obj?.cancellationReason);
    return typeof raw === 'string' ? raw.trim() : raw;
  })
  @IsNotEmpty({ message: 'Alasan pembatalan wajib diisi.' })
  @IsString({ message: 'Alasan pembatalan harus berupa teks.' })
  @MinLength(5, {
    message: 'Alasan pembatalan minimal harus terdiri dari 5 karakter.',
  })
  @MaxLength(1000, {
    message: 'Alasan pembatalan tidak boleh melebihi 1000 karakter.',
  })
  reason: string;
}
