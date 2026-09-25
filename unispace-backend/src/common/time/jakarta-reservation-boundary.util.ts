/**
 * Menghasilkan boundary hari dan waktu saat ini di Asia/Jakarta dalam Date UTC
 * agar konsisten dengan representasi tanggal reservasi di PostgreSQL.
 */
export function jakartaReservationBoundary(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);

  const numberPart = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Unable to determine Jakarta ${type}.`);
    }
    return Number(value);
  };

  const year = numberPart('year');
  const month = numberPart('month');
  const day = numberPart('day');
  const hour = numberPart('hour');
  const minute = numberPart('minute');
  const second = numberPart('second');

  return {
    usageDate: new Date(Date.UTC(year, month - 1, day)),
    endTime: new Date(Date.UTC(1970, 0, 1, hour, minute, second)),
  };
}
