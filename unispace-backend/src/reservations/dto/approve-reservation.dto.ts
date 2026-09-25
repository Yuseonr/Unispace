import { IsOptional } from 'class-validator';

export class ApproveReservationDto {
  /**
   * Field kompatibilitas sementara untuk frontend lama.
   * Backend mengabaikan nilainya dan memilih unit fisik QUANTITY yang bebas.
   */
  @IsOptional()
  allocatedAssetIds?: string[];
}
