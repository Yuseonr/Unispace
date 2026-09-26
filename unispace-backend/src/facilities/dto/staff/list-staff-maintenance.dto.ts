import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value !== '' ? Number(value) : value;

/** Filter read-only untuk periode perbaikan yang masih aktif atau terjadwal. */
export class ListStaffMaintenanceDto {
  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'SCHEDULED'])
  state: 'ALL' | 'ACTIVE' | 'SCHEDULED' = 'ALL';

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
