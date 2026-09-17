import {
  parseTimeToMinutes,
  isValidSlotBoundary,
  isWithinOperationHours,
  isTimeOverlapping,
  isOperationalDay,
  addOperationalDays,
  isWithinLeadTime,
  isWithinMaxAdvance,
  calculateDecisionDeadline,
  isCancellationAllowed,
} from './reservation-time.util';

describe('Reservation Time Utils', () => {
  // 1. Uji Konversi Jam ke Menit
  describe('parseTimeToMinutes', () => {
    it('harus benar mengubah format HH:mm ke total menit', () => {
      expect(parseTimeToMinutes('07:00')).toBe(420);
      expect(parseTimeToMinutes('07:30')).toBe(450);
      expect(parseTimeToMinutes('20:00')).toBe(1200);
    });

    it('harus melempar error jika format waktu salah', () => {
      expect(() => parseTimeToMinutes('invalid')).toThrow(
        'Invalid time format',
      );
      expect(() => parseTimeToMinutes('25:00')).toThrow('Invalid time format');
      expect(() => parseTimeToMinutes('08:65')).toThrow('Invalid time format');
    });
  });

  // 2. Uji Batas Slot 30 Menit
  describe('isValidSlotBoundary', () => {
    it('harus menerima menit 00 dan 30', () => {
      expect(isValidSlotBoundary('08:00')).toBe(true);
      expect(isValidSlotBoundary('08:30')).toBe(true);
    });

    it('harus menolak jika menit bukan 00 atau 30', () => {
      expect(isValidSlotBoundary('08:15')).toBe(false);
      expect(isValidSlotBoundary('08:45')).toBe(false);
      expect(isValidSlotBoundary('08:10')).toBe(false);
    });
  });

  // 3. Uji Jam Operasional (07.00 - 20.00)
  describe('isWithinOperationHours', () => {
    it('harus valid jika jam berada di antara 07.00 - 20.00 dan start < end', () => {
      expect(isWithinOperationHours('07:00', '09:00')).toBe(true);
      expect(isWithinOperationHours('18:00', '20:00')).toBe(true);
    });

    it('harus menolak jika di luar jam operasional atau jam terbalik', () => {
      expect(isWithinOperationHours('06:30', '08:00')).toBe(false); // Terlalu pagi
      expect(isWithinOperationHours('19:00', '20:30')).toBe(false); // Terlalu malam
      expect(isWithinOperationHours('10:00', '08:00')).toBe(false); // Terbalik
      expect(isWithinOperationHours('08:00', '08:00')).toBe(false); // Durasi 0 menit
    });
  });

  // 4. Uji Bentrok Waktu (Overlap)
  describe('isTimeOverlapping', () => {
    it('harus mendeteksi bentrok jika waktu saling menimpa', () => {
      expect(isTimeOverlapping('07:30', '10:00', '08:30', '09:00')).toBe(true);
      expect(isTimeOverlapping('08:00', '09:00', '08:30', '09:30')).toBe(true);
    });

    it('harus menghasilkan false jika waktu bersentuhan tepat di perbatasan (tidak tumpang tindih)', () => {
      expect(isTimeOverlapping('08:00', '09:00', '09:00', '10:00')).toBe(false);
    });
  });

  // 5. Uji Hari Kerja Operasional (Senin-Jumat)
  describe('isOperationalDay & addOperationalDays', () => {
    it('harus membedakan hari kerja dan akhir pekan', () => {
      expect(isOperationalDay('2026-09-18')).toBe(true); // Jumat
      expect(isOperationalDay('2026-09-19')).toBe(false); // Sabtu
      expect(isOperationalDay('2026-09-20')).toBe(false); // Minggu
      expect(isOperationalDay('2026-09-21')).toBe(true); // Senin
    });

    it('harus melompati Sabtu dan Minggu saat menambah hari kerja', () => {
      expect(addOperationalDays('2026-09-18', 1)).toBe('2026-09-21');
      expect(addOperationalDays('2026-09-18', 2)).toBe('2026-09-22');
      expect(addOperationalDays('2026-09-16', 2)).toBe('2026-09-18');
    });
  });

  // 6. Uji H-2 dan Maksimal 14 Hari
  describe('isWithinLeadTime & isWithinMaxAdvance', () => {
    it('harus menolak jika kurang dari H-2 hari kerja', () => {
      const submissionDate = new Date('2026-09-16T10:00:00+07:00');
      expect(isWithinLeadTime('2026-09-17', submissionDate)).toBe(false);
      expect(isWithinLeadTime('2026-09-18', submissionDate)).toBe(true);
    });

    it('harus menolak jika melebihi 14 hari kalender', () => {
      const submissionDate = new Date('2026-09-16T10:00:00+07:00');
      expect(isWithinMaxAdvance('2026-09-30', submissionDate)).toBe(true);
      expect(isWithinMaxAdvance('2026-10-01', submissionDate)).toBe(false);
    });
  });

  // 7. Uji SLA Decision Deadline Petugas
  describe('calculateDecisionDeadline', () => {
    it('harus menghitung tenggat jam 20.00 hari kerja berikutnya jika lebih awal', () => {
      const createdAt = new Date('2026-09-14T10:00:00+07:00'); // Senin
      const usageDateStr = '2026-09-21'; // Senin depan
      const deadline = calculateDecisionDeadline(createdAt, usageDateStr);
      expect(deadline.toISOString()).toBe(
        new Date('2026-09-15T20:00:00+07:00').toISOString(),
      );
    });
  });

  // 8. Uji Batas Pembatalan oleh Pengguna
  describe('isCancellationAllowed', () => {
    it('harus mengizinkan sebelum jam 20.00 H-1 hari kerja', () => {
      const usageDateStr = '2026-09-21'; // Senin
      const beforeDeadline = new Date('2026-09-18T19:30:00+07:00');
      const afterDeadline = new Date('2026-09-18T20:30:00+07:00');

      expect(isCancellationAllowed(usageDateStr, beforeDeadline)).toBe(true);
      expect(isCancellationAllowed(usageDateStr, afterDeadline)).toBe(false);
    });
  });
});
