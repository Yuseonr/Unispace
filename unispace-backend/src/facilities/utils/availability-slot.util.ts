export const FACILITY_SLOT_COUNT = 26;

/** Mengubah indeks slot 0–25 menjadi batas waktu operasional 07.00–20.00. */
export function facilitySlotTime(index: number) {
  const startHour = 7 + Math.floor(index / 2);
  const startMinute = (index % 2) * 30;
  const endHour = 7 + Math.floor((index + 1) / 2);
  const endMinute = ((index + 1) % 2) * 30;
  const pad = (value: number) => value.toString().padStart(2, '0');

  return {
    startHour,
    startMinute,
    endHour,
    endMinute,
    startTime: `${pad(startHour)}:${pad(startMinute)}`,
    endTime: `${pad(endHour)}:${pad(endMinute)}`,
  };
}
