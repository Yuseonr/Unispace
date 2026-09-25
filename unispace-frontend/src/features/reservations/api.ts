import { apiRequest } from "@/lib/api/client";

import type {
  ApproveStaffReservationInput,
  AutoRejectExpiredResponse,
  CancelStaffReservationInput,
  CreateReservationInput,
  FacilityAvailabilityData,
  ListMyReservationsQuery,
  ListStaffReservationsQuery,
  MyReservationsResponse,
  RejectStaffReservationInput,
  ReservationStatus,
  ReservationSummary,
  StaffReservationItem,
  StaffReservationsResponse,
  UserReservationItem,
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

export interface OperationalDateOption {
  dayName: string;
  dayShort: string;
  formattedDate: string;
  label: string;
  value: string;
}

const OPERATIONAL_DAY_NAMES: Record<number, { full: string; short: string }> = {
  1: { full: "Senin", short: "SEN" },
  2: { full: "Selasa", short: "SEL" },
  3: { full: "Rabu", short: "RAB" },
  4: { full: "Kamis", short: "KAM" },
  5: { full: "Jumat", short: "JUM" },
};

/**
 * Format tanggal YYYY-MM-DD menjadi format tanggal saja (contoh: "28 September 2026")
 */
export function formatDateOnlyIndonesian(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(`${dateStr}T12:00:00+07:00`);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      timeZone: TIMEZONE,
      year: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
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
 * Dapatkan daftar seluruh tanggal hari kerja operasional yang valid dipilih
 * (mulai dari minimal H-2 hari kerja s.d. 14 hari kalender ke depan)
 */
export function getAvailableOperationalDates(referenceDate = new Date()): OperationalDateOption[] {
  const { maxDate, minDate } = getReservationDateBounds(referenceDate);
  const dates: OperationalDateOption[] = [];

  const cur = new Date(`${minDate}T12:00:00+07:00`);
  const end = new Date(`${maxDate}T12:00:00+07:00`);

  while (cur <= end) {
    const dateStr = formatJakartaDate(cur);
    if (isOperationalDay(dateStr)) {
      const dayNum = getJakartaDayOfWeek(dateStr);
      const dayInfo = OPERATIONAL_DAY_NAMES[dayNum] ?? { full: "Hari Kerja", short: "HK" };

      dates.push({
        dayName: dayInfo.full,
        dayShort: dayInfo.short,
        formattedDate: formatDateOnlyIndonesian(dateStr),
        label: formatDateIndonesian(dateStr),
        value: dateStr,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  return dates;
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

export type AuthenticatedRequestFn = <T>(
  path: string,
  options?: {
    body?: BodyInit | Record<string, unknown> | null;
    method?: string;
  },
) => Promise<T>;

/**
 * Kirim permohonan reservasi baru via request terautentikasi
 */
export async function createReservation(
  input: CreateReservationInput,
  requestFn: AuthenticatedRequestFn,
): Promise<ReservationSummary> {
  return requestFn<ReservationSummary>("/reservations", {
    body: input as Record<string, unknown>,
    method: "POST",
  });
}

/**
 * Ambil daftar riwayat reservasi pengguna (mendukung filter status, tanggal, dan paginasi)
 */
export async function fetchMyReservations(
  query: ListMyReservationsQuery = {},
  requestFn: AuthenticatedRequestFn,
): Promise<MyReservationsResponse> {
  const searchParams = new URLSearchParams();
  if (query.status) searchParams.set("status", query.status);
  if (query.usageDate) searchParams.set("usageDate", query.usageDate);
  if (query.page) searchParams.set("page", String(query.page));
  if (query.limit) searchParams.set("limit", String(query.limit));

  const qs = searchParams.toString();
  return requestFn<MyReservationsResponse>(`/reservations/my${qs ? `?${qs}` : ""}`);
}

/**
 * Batalkan reservasi mandiri oleh pemohon (hanya PENDING/APPROVED dan sebelum H-1 20.00 WIB)
 */
export async function cancelMyReservation(
  id: string,
  requestFn: AuthenticatedRequestFn,
): Promise<UserReservationItem> {
  return requestFn<UserReservationItem>(`/reservations/my/${id}/cancel`, {
    method: "PATCH",
  });
}

/**
 * Ambil daftar antrean permohonan reservasi untuk petugas (FR-RES-03)
 */
export async function fetchStaffReservations(
  query: ListStaffReservationsQuery = {},
  requestFn: AuthenticatedRequestFn,
): Promise<StaffReservationsResponse> {
  const searchParams = new URLSearchParams();
  if (query.status) searchParams.set("status", query.status);
  if (query.usageDate) searchParams.set("usageDate", query.usageDate);
  if (query.facilityId) searchParams.set("facilityId", query.facilityId);
  if (query.facilityGroupId) searchParams.set("facilityGroupId", query.facilityGroupId);
  if (query.facilityAreaId) searchParams.set("facilityAreaId", query.facilityAreaId);
  if (query.search) searchParams.set("search", query.search);
  if (query.page) searchParams.set("page", String(query.page));
  if (query.limit) searchParams.set("limit", String(query.limit));

  const qs = searchParams.toString();
  return requestFn<StaffReservationsResponse>(`/staff/reservations${qs ? `?${qs}` : ""}`);
}

/**
 * Ambil rincian lengkap satu permohonan reservasi untuk petugas (FR-RES-03)
 */
export async function getStaffReservationDetail(
  id: string,
  requestFn: AuthenticatedRequestFn,
): Promise<StaffReservationItem> {
  return requestFn<StaffReservationItem>(`/staff/reservations/${id}`);
}

/**
 * Menyetujui permohonan reservasi secara atomik oleh petugas (FR-RES-04 & RULE-RES-05)
 * - Mode Ruang (EXCLUSIVE): tanpa allocatedAssetIds
 * - Mode Alat (QUANTITY): wajib menyertakan allocatedAssetIds
 */
export async function approveStaffReservation(
  id: string,
  input: ApproveStaffReservationInput,
  requestFn: AuthenticatedRequestFn,
): Promise<StaffReservationItem> {
  return requestFn<StaffReservationItem>(`/staff/reservations/${id}/approve`, {
    body: input as Record<string, unknown>,
    method: "PATCH",
  });
}

/**
 * Menolak permohonan reservasi berstatus PENDING oleh petugas dengan alasan wajib (FR-RES-05 & RULE-RES-08)
 */
export async function rejectStaffReservation(
  id: string,
  input: RejectStaffReservationInput,
  requestFn: AuthenticatedRequestFn,
): Promise<StaffReservationItem> {
  return requestFn<StaffReservationItem>(`/staff/reservations/${id}/reject`, {
    body: input as Record<string, unknown>,
    method: "PATCH",
  });
}

/**
 * Membatalkan permohonan reservasi aktif (PENDING/APPROVED) oleh petugas dengan alasan wajib (FR-RES-07 & RULE-RES-08)
 */
export async function cancelStaffReservation(
  id: string,
  input: CancelStaffReservationInput,
  requestFn: AuthenticatedRequestFn,
): Promise<StaffReservationItem> {
  return requestFn<StaffReservationItem>(`/staff/reservations/${id}/cancel`, {
    body: input as Record<string, unknown>,
    method: "PATCH",
  });
}

/**
 * Memicu evaluasi dan penolakan otomatis reservasi PENDING yang melewati batas SLA (FR-RES-08)
 */
export async function triggerAutoRejectExpired(
  requestFn: AuthenticatedRequestFn,
): Promise<AutoRejectExpiredResponse> {
  return requestFn<AutoRejectExpiredResponse>("/staff/reservations/auto-reject-expired", {
    method: "POST",
  });
}

/**
 * Evaluasi status urgensi batas waktu keputusan SLA petugas (RULE-RES-04)
 */
export function getSlaUrgencyStatus(
  deadlineStr: string,
  now: Date = new Date(),
): {
  isExpired: boolean;
  isUrgent: boolean;
  remainingText: string;
  urgencyLevel: "danger" | "expired" | "normal" | "warning";
} {
  if (!deadlineStr) {
    return {
      isExpired: false,
      isUrgent: false,
      remainingText: "Tidak ada tenggat",
      urgencyLevel: "normal",
    };
  }

  const deadline = new Date(deadlineStr);
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isExpired: true,
      isUrgent: true,
      remainingText: "Batas waktu SLA terlampaui",
      urgencyLevel: "expired",
    };
  }

  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 4) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return {
      isExpired: false,
      isUrgent: true,
      remainingText: `Kritis: Sisa ${diffMinutes < 60 ? `${diffMinutes} menit` : `${Math.floor(diffHours)} jam ${diffMinutes % 60} m`} lagi`,
      urgencyLevel: "danger",
    };
  }

  if (diffHours < 12) {
    return {
      isExpired: false,
      isUrgent: true,
      remainingText: `Urgensi tinggi: Sisa ${Math.floor(diffHours)} jam lagi`,
      urgencyLevel: "warning",
    };
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays >= 1) {
    return {
      isExpired: false,
      isUrgent: false,
      remainingText: `Sisa ${diffDays} hari lagi`,
      urgencyLevel: "normal",
    };
  }

  return {
    isExpired: false,
    isUrgent: false,
    remainingText: `Sisa ${Math.floor(diffHours)} jam lagi`,
    urgencyLevel: "normal",
  };
}

/**
 * Format string jam HH:mm (mendukung format "08:00" maupun ISO Date "1970-01-01T08:00:00.000Z")
 */
export function formatSlotTime(timeStr: string): string {
  if (!timeStr) return "--:--";
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  if (/^\d{2}:\d{2}:/.test(timeStr)) return timeStr.slice(0, 5);
  try {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      const h = String(d.getUTCHours()).padStart(2, "0");
      const m = String(d.getUTCMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }
  } catch {
    // fallback
  }
  return timeStr;
}

/**
 * Konfigurasi badge status reservasi (label dalam Bahasa Indonesia dan varian visual)
 */
export function getReservationStatusConfig(status: ReservationStatus): {
  badgeClass: string;
  description: string;
  label: string;
} {
  switch (status) {
    case "PENDING":
      return {
        badgeClass: "badge--pending",
        description: "Menunggu verifikasi dan persetujuan dari petugas kampus.",
        label: "Menunggu",
      };
    case "APPROVED":
      return {
        badgeClass: "badge--approved",
        description: "Permohonan telah disetujui. Fasilitas siap digunakan sesuai jadwal.",
        label: "Disetujui",
      };
    case "REJECTED":
      return {
        badgeClass: "badge--rejected",
        description: "Permohonan tidak dapat disetujui.",
        label: "Ditolak",
      };
    case "CANCELLED_BY_USER":
      return {
        badgeClass: "badge--cancelled",
        description: "Reservasi dibatalkan secara mandiri oleh pemohon.",
        label: "Dibatalkan Pengguna",
      };
    case "CANCELLED_BY_STAFF":
      return {
        badgeClass: "badge--cancelled",
        description: "Reservasi dibatalkan oleh pihak pengelola / petugas.",
        label: "Dibatalkan Petugas",
      };
    case "CANCELLED_BY_SYSTEM":
      return {
        badgeClass: "badge--cancelled",
        description: "Reservasi dibatalkan otomatis oleh sistem karena melewati tenggat waktu keputusan.",
        label: "Dibatalkan Sistem",
      };
    case "COMPLETED":
      return {
        badgeClass: "badge--completed",
        description: "Kegiatan peminjaman telah selesai dilaksanakan.",
        label: "Selesai",
      };
    default:
      return {
        badgeClass: "badge--default",
        description: "",
        label: status,
      };
  }
}

