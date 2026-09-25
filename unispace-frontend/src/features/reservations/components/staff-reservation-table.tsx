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
  onApprove,
  onDetail,
  onReject,
  reservations,
}: StaffReservationTableProps) {
  if (isLoading && reservations.length === 0) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", minWidth: "960px" }}>
          <thead>
            <tr style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.6875rem", letterSpacing: "0.04em" }}>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "center" }}>Pemohon</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "center" }}>Fasilitas</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "center" }}>Waktu</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "center" }}>Tujuan</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "center" }}>Batas SLA</th>
              <th style={{ padding: "0.5rem 0.85rem", textAlign: "center" }}>Status</th>
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
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", minWidth: "1000px", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.6875rem", letterSpacing: "0.04em" }}>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "center", width: "160px" }}>Pemohon</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "center", width: "220px" }}>Fasilitas</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "center", width: "190px" }}>Waktu</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "center", minWidth: "170px" }}>Tujuan</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "center", width: "125px" }}>Batas SLA</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "center", width: "125px" }}>Status</th>
            <th style={{ padding: "0.4rem 0.85rem", textAlign: "center", width: "140px" }}>Aksi</th>
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
                onClick={() => onDetail?.(item)}
                style={{
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
                  cursor: "pointer",
                  transition: "transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)";
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)";
                  e.currentTarget.style.backgroundColor = "#ffffff";
                }}
              >
                {/* Kolom 1: Pemohon (Hanya Nama Saja, Center) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    textAlign: "center",
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

                {/* Kolom 2: Fasilitas (Nama di Atas, Badge di Bawah, Center) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    textAlign: "center",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", alignItems: "center", justifyContent: "center" }}>
                    <strong style={{ color: "#1e293b", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                      {targetName}
                    </strong>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "3px",
                        background: isExclusive ? "#e0e7ff" : "#fef3c7",
                        color: isExclusive ? "#3730a3" : "#92400e",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isExclusive ? "Ruang Eksklusif" : `Kelompok Alat (${item.requestedQuantity} Unit)`}
                    </span>
                  </div>
                </td>

                {/* Kolom 3: Waktu (Tanggal dan Rentang Jam, Center) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    textAlign: "center",
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

                {/* Kolom 4: Tujuan (Truncated, Center) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    textAlign: "center",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    color: "#475569",
                  }}
                >
                  <span title={item.purpose} style={{ fontSize: "0.8125rem" }}>
                    {truncatePurpose(item.purpose, 32)}
                  </span>
                </td>

                {/* Kolom 5: Batas SLA (Waktu 20.00 WIB, Center) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    textAlign: "center",
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

                {/* Kolom 6: Status (Badge Center) */}
                <td
                  style={{
                    padding: "0.55rem 0.85rem",
                    verticalAlign: "middle",
                    textAlign: "center",
                    borderTop: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <span
                    className={`user-res-badge ${statusConfig.badgeClass}`}
                    style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <span className="user-res-badge__dot" aria-hidden="true" />
                    <span>{statusConfig.label}</span>
                  </span>
                </td>

                {/* Kolom 7: Aksi Petugas (Rincian, Centang [Setujui], Silang [Tolak]) */}
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
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDetail?.(item);
                      }}
                      style={{
                        padding: "4px 10px",
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

                    {item.status === "PENDING" ? (
                      <>
                        {/* Tombol Centang (Setujui) */}
                        <button
                          aria-label="Setujui permohonan"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApprove?.(item);
                          }}
                          style={{
                            alignItems: "center",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            borderRadius: "6px",
                            color: "#16a34a",
                            cursor: "pointer",
                            display: "inline-flex",
                            height: "26px",
                            justifyContent: "center",
                            padding: 0,
                            transition: "all 140ms ease",
                            width: "26px",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#16a34a";
                            e.currentTarget.style.borderColor = "#16a34a";
                            e.currentTarget.style.color = "#ffffff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f0fdf4";
                            e.currentTarget.style.borderColor = "#bbf7d0";
                            e.currentTarget.style.color = "#16a34a";
                          }}
                          title="Setujui permohonan"
                          type="button"
                        >
                          <svg
                            fill="none"
                            height="14"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                            width="14"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>

                        {/* Tombol Silang (Tolak) */}
                        <button
                          aria-label="Tolak permohonan"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReject?.(item);
                          }}
                          style={{
                            alignItems: "center",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "6px",
                            color: "#dc2626",
                            cursor: "pointer",
                            display: "inline-flex",
                            height: "26px",
                            justifyContent: "center",
                            padding: 0,
                            transition: "all 140ms ease",
                            width: "26px",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#dc2626";
                            e.currentTarget.style.borderColor = "#dc2626";
                            e.currentTarget.style.color = "#ffffff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#fef2f2";
                            e.currentTarget.style.borderColor = "#fecaca";
                            e.currentTarget.style.color = "#dc2626";
                          }}
                          title="Tolak permohonan"
                          type="button"
                        >
                          <svg
                            fill="none"
                            height="14"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                            width="14"
                          >
                            <line x1="18" x2="6" y1="6" y2="18" />
                            <line x1="6" x2="18" y1="6" y2="18" />
                          </svg>
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
