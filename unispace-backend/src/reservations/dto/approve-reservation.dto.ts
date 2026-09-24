import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class ApproveReservationDto {
  /**
   * Daftar ID unit fisik aset yang dialokasikan (khusus permohonan kelompok alat / QUANTITY).
   * Jumlah aset harus sesuai dengan requestedQuantity pada reservasi.
   */
  @IsOptional()
  @IsArray({ message: 'Daftar aset teralokasi harus berupa array.' })
  @IsUUID('4', {
    each: true,
    message: 'Setiap aset yang dialokasikan harus berupa UUID valid.',
  })
  allocatedAssetIds?: string[];
}
