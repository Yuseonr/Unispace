"use client";

import {
  formatDateOnlyIndonesian,
  formatSlotTime,
  getReservationStatusConfig,
  getSlaUrgencyStatus,
} from "../api";
import type { StaffReservationItem } from "../types";

export type StaffReservationTableProps = {
  isLoading?: boolean;
  onApprove?: (reservation: StaffReservationItem) => void;
  onCancel?: (reservation: StaffReservationItem) => void;
  onDetail?: (reservation: StaffReservationItem) => void;
  onReject?: (reservation: StaffReservationItem) => void;
  reservations: StaffReservationItem[];
};

function formatSlaTime(deadlineStr?: string | null): string {
  if (!deadlineStr) return "-";
  try {
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return "-";
    const time = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return `${time.replace(":", ".")} WIB`;
  } catch {
    return "-";
  }
}

function truncatePurpose(text: string, maxLength = 30): string {
  if (!text) return "-";
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}...`;
}

export function StaffReservationTable({
  isLoading,
  onDetail,
  reservations,
}: StaffReservationTableProps) {
  if (isLoading && reservations.length === 0) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", minWidth: "960px" }}>
          <thead>
            <tr style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.6875rem", letterSpacing: "0.04em" }}>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "left" }}>Pemohon</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "left" }}>Fasilitas</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "left" }}>Waktu</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "left" }}>Tujuan</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "left" }}>Batas SLA</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "left" }}>Status</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "center" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} style={{ background: "#ffffff", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <td colSpan={7} style={{ padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ height: "18px", background: "#f1f5f9", borderRadius: "4px", width: "100%" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3.5rem 2rem", background: "#ffffff", borderRadius: "10px", border: "1px dashed #cbd5e1", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.85rem", color: "#94a3b8" }}>
          <svg fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22">
            <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
        </div>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 0.25rem" }}>
          Tidak Ada Data Antrean
        </h3>
        <p style={{ color: "#64748b", margin: 0, fontSize: "0.8125rem" }}>
          Tidak ada permohonan reservasi yang sesuai dengan kriteria filter saat ini.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", minWidth: "960px", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.6875rem", letterSpacing: "0.04em" }}>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "left", width: "160px" }}>Pemohon</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "left", width: "220px" }}>Fasilitas</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "left", width: "190px" }}>Waktu</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "left", minWidth: "170px" }}>Tujuan</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "left", width: "125px" }}>Batas SLA</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "left", width: "125px" }}>Status</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "center", width: "95px" }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((item) => {
            const statusConfig = getReservationStatusConfig(item.status);
            const targetName = item.facility?.name ?? item.facilityGroup?.name ?? "Fasilitas Kampus";
            const isExclusive = Boolean(item.facilityId);
            const dateFormatted = formatDateOnlyIndonesian(item.usageDate.split("T")[0] ?? "");
            const timeRange = `${formatSlotTime(item.startTime)} – ${formatSlotTime(item.endTime)} WIB`;
            const sla = getSlaUrgencyStatus(item.decisionDeadline);

            return (
              <tr
                key={item.id}
                style={{
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
                  transition: "transform 140ms ease, box-shadow 140ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)";
                }}
              >
                {/* Kolom 1: Pemohon (Hanya Nama Saja) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    borderLeft: "1px solid #e2e8f0",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    borderRadius: "8px 0 0 8px",
                  }}
                >
                  <strong style={{ color: "#0f172a", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                    {item.user.name}
                  </strong>
                </td>

                {/* Kolom 2: Fasilitas (Hanya Badge dan Nama Fasilitas) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", alignItems: "flex-start" }}>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "3px",
                        background: isExclusive ? "#e0e7ff" : "#fef3c7",
                        color: isExclusive ? "#3730a3" : "#92400e",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isExclusive ? "Ruang Eksklusif" : `Kelompok Alat (${item.requestedQuantity} Unit)`}
                    </span>
                    <strong style={{ color: "#1e293b", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                      {targetName}
                    </strong>
                  </div>
                </td>

                {/* Kolom 3: Waktu (Hanya Tanggal dan Rentang Jam) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    whiteSpace: "nowrap",
                  }}
                >
                  <strong style={{ display: "block", color: "#0f172a", fontSize: "0.8125rem" }}>
                    {dateFormatted}
                  </strong>
                  <span style={{ display: "block", color: "#0284c7", fontWeight: 600, fontSize: "0.75rem", marginTop: "1px" }}>
                    {timeRange}
                  </span>
                </td>

                {/* Kolom 4: Tujuan (Truncated e.g. "untuk rapat anggota or...") */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    color: "#475569",
                  }}
                >
                  <span title={item.purpose} style={{ fontSize: "0.8125rem" }}>
                    {truncatePurpose(item.purpose, 32)}
                  </span>
                </td>

                {/* Kolom 5: Batas SLA (Waktu 20.00 WIB dengan Warna Indikator Urgensi) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {item.status === "PENDING" && item.decisionDeadline ? (
                    <span
                      title={sla.remainingText}
                      style={{
                        display: "inline-block",
                        padding: "2px 7px",
                        borderRadius: "4px",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        whiteSpace: "nowrap",
                        background:
                          sla.urgencyLevel === "danger"
                            ? "#fee2e2"
                            : sla.urgencyLevel === "warning"
                              ? "#fef3c7"
                              : sla.urgencyLevel === "expired"
                                ? "#450a0a"
                                : "#dcfce7",
                        color:
                          sla.urgencyLevel === "danger"
                            ? "#b91c1c"
                            : sla.urgencyLevel === "warning"
                              ? "#b45309"
                              : sla.urgencyLevel === "expired"
                                ? "#ffffff"
                                : "#15803d",
                      }}
                    >
                      {formatSlaTime(item.decisionDeadline)}
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>-</span>
                  )}
                </td>

                {/* Kolom 6: Status ("Menunggu", "Disetujui", dll) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <span className={`user-res-badge ${statusConfig.badgeClass}`} style={{ fontSize: "0.75rem" }}>
                    <span className="user-res-badge__dot" aria-hidden="true" />
                    <span>{statusConfig.label}</span>
                  </span>
                </td>

                {/* Kolom 7: Aksi Petugas (HANYA 1 TOMBOL: "Rincian") */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    textAlign: "center",
                    borderRight: "1px solid #e2e8f0",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    borderRadius: "0 8px 8px 0",
                  }}
                >
                  <button
                    onClick={() => onDetail?.(item)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#334155",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 140ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#e2e8f0";
                      e.currentTarget.style.color = "#0f172a";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f8fafc";
                      e.currentTarget.style.color = "#334155";
                    }}
                    type="button"
                  >
                    Rincian
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
