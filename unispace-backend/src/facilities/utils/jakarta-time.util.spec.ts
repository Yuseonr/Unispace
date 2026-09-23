import { jakartaReservationBoundary } from './jakarta-time.util';

describe('jakartaReservationBoundary', () => {
  it('mengonversi tanggal dan waktu UTC ke boundary Asia/Jakarta', () => {
    const boundary = jakartaReservationBoundary(
      new Date('2026-01-01T17:30:45.000Z'),
    );

    expect(boundary.usageDate).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(boundary.endTime).toEqual(new Date('1970-01-01T00:30:45.000Z'));
  });
});
