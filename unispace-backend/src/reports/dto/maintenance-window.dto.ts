import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsEnum,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MaintenanceMode } from '../reports.constants';
import {
  OPERATING_HOUR_END,
  OPERATING_HOUR_START,
  isValidSlotBoundary,
  parseTimeToMinutes,
} from '../../reservations/utils/reservation-time.util';

const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

@ValidatorConstraint({ name: 'maintenanceSlot', async: false })
export class MaintenanceSlotConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
      return false;
    }
    const minutes = parseTimeToMinutes(value);
    return (
      minutes >= OPERATING_HOUR_START * 60 &&
      minutes <= OPERATING_HOUR_END * 60 &&
      isValidSlotBoundary(value)
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a 30-minute slot between 07:00 and 20:00 (e.g. 07:00, 07:30).`;
  }
}

@ValidatorConstraint({ name: 'maintenanceRange', async: false })
export class MaintenanceRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as MaintenanceWindowDto;

    if (dto.mode === MaintenanceMode.DATE_RANGE) {
      if (
        typeof dto.startDate !== 'string' ||
        typeof dto.endDate !== 'string'
      ) {
        return true;
      }
      if (
        dto.date !== undefined ||
        dto.startTime !== undefined ||
        dto.endTime !== undefined
      ) {
        return false;
      }
      return new Date(dto.endDate) >= new Date(dto.startDate);
    }

    if (dto.mode === MaintenanceMode.TIME_RANGE) {
      if (
        typeof dto.date !== 'string' ||
        typeof dto.startTime !== 'string' ||
        typeof dto.endTime !== 'string'
      ) {
        return true;
      }
      if (dto.startDate !== undefined || dto.endDate !== undefined) {
        return false;
      }
      if (
        !/^\d{2}:\d{2}$/.test(dto.startTime) ||
        !/^\d{2}:\d{2}$/.test(dto.endTime)
      ) {
        return true;
      }
      return (
        parseTimeToMinutes(dto.startTime) < parseTimeToMinutes(dto.endTime)
      );
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    void args;
    return 'Maintenance fields must match the selected mode and end after they start.';
  }
}

export class MaintenanceWindowDto {
  @IsEnum(MaintenanceMode)
  @Validate(MaintenanceRangeConstraint)
  mode!: MaintenanceMode;

  @ValidateIf(
    (dto: MaintenanceWindowDto) => dto.mode === MaintenanceMode.DATE_RANGE,
  )
  @IsDefined({ message: 'startDate is required for DATE_RANGE mode.' })
  @IsDateString()
  startDate?: string;

  @ValidateIf(
    (dto: MaintenanceWindowDto) => dto.mode === MaintenanceMode.DATE_RANGE,
  )
  @IsDefined({ message: 'endDate is required for DATE_RANGE mode.' })
  @IsDateString()
  endDate?: string;

  @ValidateIf(
    (dto: MaintenanceWindowDto) => dto.mode === MaintenanceMode.TIME_RANGE,
  )
  @IsDefined({ message: 'date is required for TIME_RANGE mode.' })
  @IsDateString()
  date?: string;

  @ValidateIf(
    (dto: MaintenanceWindowDto) => dto.mode === MaintenanceMode.TIME_RANGE,
  )
  @IsDefined({ message: 'startTime is required for TIME_RANGE mode.' })
  @Transform(trimValue)
  @Validate(MaintenanceSlotConstraint)
  startTime?: string;

  @ValidateIf(
    (dto: MaintenanceWindowDto) => dto.mode === MaintenanceMode.TIME_RANGE,
  )
  @IsDefined({ message: 'endTime is required for TIME_RANGE mode.' })
  @Transform(trimValue)
  @Validate(MaintenanceSlotConstraint)
  endTime?: string;
}
