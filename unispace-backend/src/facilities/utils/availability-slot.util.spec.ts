import {
  FACILITY_SLOT_COUNT,
  facilitySlotTime,
} from './availability-slot.util';

describe('facilitySlotTime', () => {
  it('membentuk 26 slot 30 menit dari 07.00 hingga 20.00', () => {
    expect(FACILITY_SLOT_COUNT).toBe(26);
    expect(facilitySlotTime(0)).toMatchObject({
      startTime: '07:00',
      endTime: '07:30',
    });
    expect(facilitySlotTime(25)).toMatchObject({
      startTime: '19:30',
      endTime: '20:00',
    });
  });
});
