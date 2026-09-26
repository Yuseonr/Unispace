import { ApiError } from "./client";

const CODE_MESSAGES: Record<string, string> = {
  ACCOUNT_INACTIVE: "Akun tidak aktif. Hubungi administrator kampus.",
  ACCOUNT_NOT_VERIFIED: "Akun belum diverifikasi. Selesaikan verifikasi terlebih dahulu.",
  ACCOUNT_REJECTED: "Pendaftaran akun ditolak. Periksa alasan pada status akun.",
  AVAILABILITY_CHANGED: "Ketersediaan sudah berubah. Muat ulang jadwal sebelum mencoba lagi.",
  FACILITY_MAINTENANCE_ACTIVE: "Fasilitas sedang dalam perbaikan pada waktu yang dipilih.",
  FACILITY_NOT_ACTIVE: "Fasilitas ini tidak aktif dan tidak dapat diproses.",
  MAINTENANCE_INVALID_OVERRIDE: "Periode hanya dapat diakhiri lebih awal saat sedang aktif.",
  MAINTENANCE_PERIOD_IN_PAST: "Jadwal perbaikan harus dimulai sekarang atau di masa depan.",
  REPORT_INVALID_TRANSITION: "Status laporan sudah berubah. Muat ulang detail laporan.",
  REPORT_NOT_IN_PROGRESS: "Jadwal perbaikan hanya dapat dibuat dari laporan yang sedang diproses.",
  RESERVATION_INVALID_TRANSITION: "Status reservasi sudah berubah. Muat ulang data sebelum melanjutkan.",
  RESERVATION_SLOT_UNAVAILABLE: "Salah satu slot tidak lagi tersedia. Muat ulang ketersediaan.",
  RESERVATION_STOCK_UNAVAILABLE: "Stok alat tidak lagi mencukupi untuk jumlah yang dipilih.",
};

export function readableApiError(error: unknown, fallback = "Terjadi kendala. Silakan coba lagi.") {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return CODE_MESSAGES[error.code ?? ""] ?? "Data berubah di server. Muat ulang data sebelum melanjutkan.";
    }
    return CODE_MESSAGES[error.code ?? ""] ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function isStaleApiError(error: unknown) {
  return error instanceof ApiError && error.status === 409;
}
