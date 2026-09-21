import { IsEnum } from 'class-validator';
import { FacilityStatus } from '../../generated/prisma/client';

export class UpdateFacilityStatusDto {
  @IsEnum(FacilityStatus, {
    message: 'status harus berupa ACTIVE atau NONACTIVE',
  })
  status!: FacilityStatus;
}
