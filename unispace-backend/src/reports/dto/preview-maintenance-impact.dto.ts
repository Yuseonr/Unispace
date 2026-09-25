import { IsDateString } from 'class-validator';

export class PreviewMaintenanceImpactDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}
