import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MaintenanceMode } from '../maintenance.constants';
import { CreateDirectMaintenanceDto } from './create-direct-maintenance.dto';

describe('CreateDirectMaintenanceDto', () => {
  const validPayload = {
    mode: MaintenanceMode.TIME_RANGE,
    date: '2026-10-06',
    startTime: '07:00',
    endTime: '08:00',
    note: 'Perbaikan AC',
    cancellationReason: 'Ruang ditutup untuk perbaikan AC',
    cancelImpactedReservations: true,
  };

  it.each(['06:30', '07:15', '20:30'])(
    'rejects an invalid direct-maintenance start slot: %s',
    async (startTime) => {
      const dto = plainToInstance(CreateDirectMaintenanceDto, {
        ...validPayload,
        startTime,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'startTime')).toBe(true);
    },
  );

  it('requires a nonblank cancellation reason for confirmation', async () => {
    const dto = plainToInstance(CreateDirectMaintenanceDto, {
      ...validPayload,
      cancellationReason: '   ',
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'cancellationReason'),
    ).toBe(true);
  });
});
