import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectReservationDto {
  /**
   * Alasan penolakan permohonan reservasi (wajib diisi, minimal 5 karakter).
   */
  @Transform(({ obj, value }) => {
    const raw = typeof value === 'string' ? value : obj?.decisionReason;
    return typeof raw === 'string' ? raw.trim() : raw;
  })
  @IsNotEmpty({ message: 'Alasan penolakan wajib diisi.' })
  @IsString({ message: 'Alasan penolakan harus berupa teks.' })
  @MinLength(5, {
    message: 'Alasan penolakan minimal harus terdiri dari 5 karakter.',
  })
  @MaxLength(1000, {
    message: 'Alasan penolakan tidak boleh melebihi 1000 karakter.',
  })
  reason: string;
}
