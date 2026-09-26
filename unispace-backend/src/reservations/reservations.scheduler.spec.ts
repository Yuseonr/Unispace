import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { ReservationsScheduler } from './reservations.scheduler';
import { ReservationsService } from './reservations.service';

describe('ReservationsScheduler', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executes the centralized SLA rejection job', async () => {
    const reservations = {
      autoRejectExpiredReservations: jest.fn().mockResolvedValue(2),
    } as unknown as ReservationsService;
    const scheduler = new ReservationsScheduler(reservations);

    await scheduler.rejectExpiredReservations();

    expect(reservations.autoRejectExpiredReservations).toHaveBeenCalledTimes(1);
  });

  it('executes the finished reservation completion job', async () => {
    const reservations = {
      completeFinishedReservations: jest.fn().mockResolvedValue(1),
    } as unknown as ReservationsService;
    const scheduler = new ReservationsScheduler(reservations);

    await scheduler.completeFinishedReservations();

    expect(reservations.completeFinishedReservations).toHaveBeenCalledTimes(1);
  });

  it('contains job failures so the scheduler keeps running', async () => {
    const reservations = {
      autoRejectExpiredReservations: jest
        .fn()
        .mockRejectedValue(new Error('database unavailable')),
    } as unknown as ReservationsService;
    const scheduler = new ReservationsScheduler(reservations);

    await expect(
      scheduler.rejectExpiredReservations(),
    ).resolves.toBeUndefined();
  });
});
