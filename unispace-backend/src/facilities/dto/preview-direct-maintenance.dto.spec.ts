import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MaintenanceMode } from '../maintenance.constants';
import { PreviewDirectMaintenanceDto } from './preview-direct-maintenance.dto';

describe('PreviewDirectMaintenanceDto', () => {
  it('accepts a maintenance window without confirmation fields', async () => {
    const dto = plainToInstance(PreviewDirectMaintenanceDto, {
      mode: MaintenanceMode.TIME_RANGE,
      date: '2026-10-06',
      startTime: '07:00',
      endTime: '08:00',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
