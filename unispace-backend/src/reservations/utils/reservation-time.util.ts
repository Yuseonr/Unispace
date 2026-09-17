// 1. ATURAN DASAR WAKTU (KONSTANTA)

// Zona waktu resmi kampus adalah WIB (Asia/Jakarta)
export const TIMEZONE = 'Asia/Jakarta';

// Jam operasional fasilitas: Buka jam 07.00, Tutup jam 20.00
export const OPERATING_HOUR_START = 7;
export const OPERATING_HOUR_END = 20;

// Reservasi memakai kelipatan 30 menit (misal: 07.00, 07.30, 08.00)
export const SLOT_MINUTES = 30;

// Pengajuan minimal H-2 hari kerja sebelum tanggal dipakai
export const LEAD_TIME_DAYS = 2;

// Pengajuan maksimal 14 hari kalender ke depan
export const MAX_ADVANCE_DAYS = 14;

// 2. HELPER JAM & SLOT 30 MENIT

/**
 * mengubag format jam "HH:mm" menjadi total menit dari jam 00.00
 * Contoh : "07:30" -> (7 * 60) + 30 = 450 menit
 */
export function parseTimeToMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid time format');
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error('Invalid time format');
  }

  return hours * 60 + minutes;
}

/**
 * Mengecek apakah jam berada tepat di batas slot 30 menit (menit harus 00 atau 30)
 * Contoh valid: "07:00", "07:30"
 * Contoh tidak valid: "07:15", "07:45"
 */
export function isValidSlotBoundary(timeStr: string): boolean {
  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const minute = parseInt(parts[1], 10);
  return minute % SLOT_MINUTES === 0;
}

/**
 * Mengecek apakah rentang jam valid:
 * 1. Mulai < Selesai
 * 2. Minimal jam 07.00
 * 3. Maksimal jam 20.00
 */
export function isWithinOperationHours(
  startTime: string,
  endTime: string,
): boolean {
  try {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);

    const openingMinutes = OPERATING_HOUR_START * 60;
    const closingMinutes = OPERATING_HOUR_END * 60;

    return (
      startMinutes < endMinutes &&
      startMinutes >= openingMinutes &&
      endMinutes <= closingMinutes
    );
  } catch {
    return false;
  }
}

/**
 * Mengecek apakah dua rentang waktu saling bertabrakan / tumpang tindih (overlap).
 * Contoh kasus:
 * Pesan A (07:30 - 10:00) vs Yang sudah ada B (08:30 - 09:00) -> true (BENTROK!)
 */
export function isTimeOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const startAMinutes = parseTimeToMinutes(startA);
  const endAMinutes = parseTimeToMinutes(endA);
  const startBMinutes = parseTimeToMinutes(startB);
  const endBMinutes = parseTimeToMinutes(endB);

  // Rumus universal overlap: StartA < EndB && EndA > StartB
  return startAMinutes < endBMinutes && endAMinutes > startBMinutes;
}

// 3. HELPER TANGGAL & HARI OPERASIONAL

/**
 * Mengubah objek Date ke teks tanggal "YYYY-MM-DD" sesuai zona waktu Asia/Jakarta (WIB)
 */
export function formatToJakartaDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

/**
 * Mendapatkan nomor hari dalam sepekan di zona Jakarta:
 * 0 = Minggu, 1 = Senin, ..., 5 = Jumat, 6 = Sabtu
 */
export function getJakartaDayOfWeek(dateStr: string): number {
  // Parsing YYYY-MM-DD di tengah hari jam 12.00 WIB agar aman dari pergeseran zona waktu
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
  }).format(date);

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return dayMap[dayName];
}

/**
 * Mengecek apakah tanggal tersebut adalah hari operasional kampus (Senin s/d Jumat)
 * Sabtu (6) dan Minggu (0) akan menghasilkan false.
 */
export function isOperationalDay(dateStr: string): boolean {
  const day = getJakartaDayOfWeek(dateStr);
  return day >= 1 && day <= 5;
}

/**
 * Menambahkan sejumlah hari kerja operasional (melompati Sabtu dan Minggu)
 * Contoh:
 * Jika hari Jumat (2026-09-18) ditambah 2 hari kerja -> hasilnya hari Selasa (2026-09-22)
 */
export function addOperationalDays(
  startDateStr: string,
  daysToAdd: number,
): string {
  const currentDate = new Date(`${startDateStr}T12:00:00+07:00`);
  let added = 0;

  while (added < daysToAdd) {
    // Geser 1 hari ke depan
    currentDate.setDate(currentDate.getDate() + 1);
    const dateStr = formatToJakartaDateString(currentDate);

    // Jika hari kerja (Senin - Jumat), kuota added bertambah
    if (isOperationalDay(dateStr)) {
      added++;
    }
  }

  return formatToJakartaDateString(currentDate);
}

/**
 * Mengecek apakah tanggal pemakaian memenuhi syarat minimal H-2 hari kerja dari hari pengajuan
 */
export function isWithinLeadTime(
  usageDateStr: string,
  submissionDate = new Date(),
): boolean {
  const submissionDateStr = formatToJakartaDateString(submissionDate);
  const earliestAllowedDateStr = addOperationalDays(
    submissionDateStr,
    LEAD_TIME_DAYS,
  );

  // Tanggal pemakaian harus >= tanggal H-2 hari kerja
  return usageDateStr >= earliestAllowedDateStr;
}

/**
 * Mengecek apakah tanggal pemakaian tidak melebihi 14 hari kalender ke depan
 */
export function isWithinMaxAdvance(
  usageDateStr: string,
  submissionDate = new Date(),
): boolean {
  const maxDate = new Date(submissionDate.getTime());
  maxDate.setDate(maxDate.getDate() + MAX_ADVANCE_DAYS);
  const maxAllowedDateStr = formatToJakartaDateString(maxDate);

  return usageDateStr <= maxAllowedDateStr;
}

/**
 * Menghitung batas waktu (SLA Decision Deadline) keputusan petugas.
 * Pukul 20.00 pada hari operasional berikutnya setelah tanggal pengajuan,
 * ATAU pukul 20.00 pada H-1 tanggal penggunaan, mana yang lebih awal.
 */
export function calculateDecisionDeadline(
  createdAt: Date,
  usageDateStr: string,
): Date {
  const createdDateStr = formatToJakartaDateString(createdAt);

  // 1. Pukul 20.00 pada hari kerja berikutnya setelah tanggal pengajuan (+1 hari kerja)
  const nextOperationalDayStr = addOperationalDays(createdDateStr, 1);
  const deadlineFromSubmission = new Date(
    `${nextOperationalDayStr}T20:00:00+07:00`,
  );

  // 2. Pukul 20.00 pada H-1 hari kerja sebelum tanggal penggunaan (-1 hari kerja)
  // Cara mundur: cari tanggal sebelum usageDate yang merupakan hari operasional
  const tempDate = new Date(`${usageDateStr}T12:00:00+07:00`);
  do {
    tempDate.setDate(tempDate.getDate() - 1);
  } while (!isOperationalDay(formatToJakartaDateString(tempDate)));

  const hMinusOneDateStr = formatToJakartaDateString(tempDate);
  const deadlineFromUsage = new Date(`${hMinusOneDateStr}T20:00:00+07:00`);

  // Ambil mana yang lebih awal (paling cepat)
  return deadlineFromSubmission.getTime() <= deadlineFromUsage.getTime()
    ? deadlineFromSubmission
    : deadlineFromUsage;
}

/**
 * Mengecek apakah pengguna masih boleh membatalkan reservasi.
 * Batas: maksimal pukul 20.00 pada H-1 hari kerja sebelum tanggal pemakaian.
 */
export function isCancellationAllowed(
  usageDateStr: string,
  now = new Date(),
): boolean {
  const tempDate = new Date(`${usageDateStr}T12:00:00+07:00`);
  do {
    tempDate.setDate(tempDate.getDate() - 1);
  } while (!isOperationalDay(formatToJakartaDateString(tempDate)));

  const cutoff = new Date(
    `${formatToJakartaDateString(tempDate)}T20:00:00+07:00`,
  );
  return now.getTime() <= cutoff.getTime();
}
