import { IsIn } from 'class-validator';
import { AccountStatus } from '../../../generated/prisma/client';

const MANAGEABLE_STATUSES = [
  AccountStatus.ACTIVE,
  AccountStatus.NONACTIVE,
] as const;

export class UpdateManagedUserStatusDto {
  @IsIn(MANAGEABLE_STATUSES)
  status: (typeof MANAGEABLE_STATUSES)[number];
}
