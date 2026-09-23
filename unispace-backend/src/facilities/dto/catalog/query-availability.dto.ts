import { IsIn, IsISO8601, IsOptional, Matches } from 'class-validator';

export class QueryAvailabilityDto {
  /**
   * Tanggal yang ingin dicek ketersediaannya (format YYYY-MM-DD).
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date harus menggunakan format YYYY-MM-DD',
  })
  @IsISO8601(
    { strict: true },
    { message: 'date harus berupa tanggal kalender yang valid' },
  )
  date!: string;

  /**
   * Jenis id yang dikirimkan:
   * 'unit' untuk unit fasilitas fisik (default / EXCLUSIVE)
   * 'group' untuk grup fasilitas (QUANTITY)
   */
  @IsOptional()
  @IsIn(['unit', 'group'])
  kind?: 'unit' | 'group' = 'unit';
}
