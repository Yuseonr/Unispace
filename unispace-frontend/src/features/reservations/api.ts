import { apiRequest } from "@/lib/api/client";

import type {
  CreateReservationInput,
  FacilityAvailabilityData,
  ReservationSummary,
} from "./types";

export const TIMEZONE = "Asia/Jakarta";
export const OPERATING_HOUR_START = 7;
export const OPERATING_HOUR_END = 20;
export const SLOT_MINUTES = 30;
export const LEAD_TIME_WORKING_DAYS = 2;
export const MAX_ADVANCE_CALENDAR_DAYS = 14;

/**
 * Format objek Date ke teks YYYY-MM-DD sesuai zona waktu Asia/Jakarta (WIB)
 */
export function formatJakartaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

/**
 * Dapatkan indeks hari dalam sepekan (0 = Minggu, 1 = Senin, ..., 5 = Jumat, 6 = Sabtu)
 */
export function getJakartaDayOfWeek(dateStr: string): number {
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(date);

  const dayMap: Record<string, number> = {
    Fri: 5,
    Mon: 1,
    Sat: 6,
    Sun: 0,
    Thu: 4,
    Tue: 2,
    Wed: 3,
  };
  return dayMap[dayName] ?? 0;
}

/**
 * Cek apakah tanggal adalah hari operasional kampus (Senin-Jumat)
 */
export function isOperationalDay(dateStr: string): boolean {
  const day = getJakartaDayOfWeek(dateStr);
  return day >= 1 && day <= 5;
}

/**
 * Tambahkan sejumlah hari kerja operasional (melewati Sabtu dan Minggu)
 */
export function addOperationalDays(startDateStr: string, daysToAdd: number): string {
  const currentDate = new Date(`${startDateStr}T12:00:00+07:00`);
  let added = 0;

  while (added < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dateStr = formatJakartaDate(currentDate);
    if (isOperationalDay(dateStr)) {
      added++;
    }
  }

  return formatJakartaDate(currentDate);
}

/**
 * Tambahkan sejumlah hari kalender biasa
 */
export function addCalendarDays(startDateStr: string, daysToAdd: number): string {
  const currentDate = new Date(`${startDateStr}T12:00:00+07:00`);
  currentDate.setDate(currentDate.getDate() + daysToAdd);
  return formatJakartaDate(currentDate);
}

/**
 * Hitung batas tanggal pengajuan reservasi:
 * - minDate: H-2 hari kerja operasional dari hari ini
 * - maxDate: 14 hari kalender dari hari ini
 */
export function getReservationDateBounds(referenceDate = new Date()): {
  maxDate: string;
  minDate: string;
  today: string;
} {
  const today = formatJakartaDate(referenceDate);
  const minDate = addOperationalDays(today, LEAD_TIME_WORKING_DAYS);
  const maxDate = addCalendarDays(today, MAX_ADVANCE_CALENDAR_DAYS);

  return { maxDate, minDate, today };
}

/**
 * Format tanggal YYYY-MM-DD menjadi teks ramah pengguna (contoh: "Senin, 28 September 2026")
 */
export function formatDateIndonesian(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(`${dateStr}T12:00:00+07:00`);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeZone: TIMEZONE,
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Fetch ketersediaan 26 slot 30 menit (07.00-20.00 WIB) untuk fasilitas tertentu
 */
export async function fetchSlotAvailability(params: {
  facilityGroupId?: string;
  facilityId?: string;
  usageDate: string;
}): Promise<FacilityAvailabilityData> {
  const searchParams = new URLSearchParams();
  if (params.facilityId) searchParams.set("facilityId", params.facilityId);
  if (params.facilityGroupId) searchParams.set("facilityGroupId", params.facilityGroupId);
  searchParams.set("usageDate", params.usageDate);

  return apiRequest<FacilityAvailabilityData>(
    `/reservations/availability?${searchParams.toString()}`,
  );
}

/**
 * Kirim permohonan reservasi baru via request terautentikasi
 */
export async function createReservation(
  input: CreateReservationInput,
  requestFn: <T>(path: string, options?: { body?: unknown; method?: string }) => Promise<T>,
): Promise<ReservationSummary> {
  return requestFn<ReservationSummary>("/reservations", {
    body: input,
    method: "POST",
  });
}
