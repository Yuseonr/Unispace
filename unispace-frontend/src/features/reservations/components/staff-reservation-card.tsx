"use client";

import {
  formatDateOnlyIndonesian,
  formatSlotTime,
  getReservationStatusConfig,
  getSlaUrgencyStatus,
} from "../api";
import type { StaffReservationItem } from "../types";

export type StaffReservationCardProps = {
  onApprove?: (reservation: StaffReservationItem) => void;
  onCancel?: (reservation: StaffReservationItem) => void;
  onDetail?: (reservation: StaffReservationItem) => void;
  onReject?: (reservation: StaffReservationItem) => void;
  reservation: StaffReservationItem;
};

export function StaffReservationCard({
  onApprove,
  onCancel,
  onDetail,
  onReject,
  reservation,
}: StaffReservationCardProps) {
  const statusConfig = getReservationStatusConfig(reservation.status);

  const targetName =
    reservation.facility?.name ??
    reservation.facilityGroup?.name ??
    "Fasilitas Kampus";

  const isExclusive = Boolean(reservation.facilityId);
  const modeLabel = isExclusive
    ? "Ruang Eksklusif"
    : `Kelompok Alat (${reservation.requestedQuantity} Unit)`;

  const areaName =
    reservation.facility?.facilityGroup?.facilityArea?.name ??
    reservation.facilityGroup?.facilityArea?.name;
  const locationDetail =
    reservation.facility?.facilityGroup?.locationDetail ??
    reservation.facilityGroup?.locationDetail;
  const locationText =
    areaName && locationDetail
      ? `${areaName} · ${locationDetail}`
      : areaName ?? locationDetail ?? "Area Kampus";

  const usageDateOnly = reservation.usageDate.split("T")[0] ?? "";
  const dateFormatted = formatDateOnlyIndonesian(usageDateOnly);
  const timeRange = `${formatSlotTime(reservation.startTime)} – ${formatSlotTime(reservation.endTime)} WIB`;

  const sla = getSlaUrgencyStatus(reservation.decisionDeadline);

  const showReason =
    (reservation.status === "REJECTED" ||
      reservation.status === "CANCELLED_BY_STAFF" ||
      reservation.status === "CANCELLED_BY_SYSTEM" ||
      reservation.status === "CANCELLED_BY_USER") &&
    Boolean(reservation.decisionReason);

  const allocatedAssets = reservation.allocatedAssets ?? [];

  return (
    <article className="user-res-card" data-status={reservation.status} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* Baris Atas: Target & Status Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: isExclusive ? "#e0e7ff" : "#fef3c7", color: isExclusive ? "#3730a3" : "#92400e" }}>
              {modeLabel}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              #{reservation.id.slice(0, 8)}
            </span>
          </div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {targetName}
          </h3>
        </div>

        <span className={`user-res-badge ${statusConfig.badgeClass}`} title={statusConfig.description}>
          <span className="user-res-badge__dot" aria-hidden="true" />
          <span>{statusConfig.label}</span>
        </span>
      </div>

      {/* Informasi Pemohon */}
      <div style={{ background: "#f8fafc", padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", fontSize: "0.8125rem" }}>
        <div>
          <span style={{ color: "#64748b", display: "block", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase" }}>Pemohon</span>
          <strong style={{ color: "#1e293b" }}>{reservation.user.name}</strong>
        </div>
        <div>
          <span style={{ color: "#64748b", display: "block", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase" }}>NIM / NIP</span>
          <span style={{ color: "#334155" }}>{reservation.user.identityNumber}</span>
        </div>
        <div>
          <span style={{ color: "#64748b", display: "block", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase" }}>Email</span>
          <span style={{ color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reservation.user.email}</span>
        </div>
      </div>

      {/* Jadwal & Lokasi */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.875rem", color: "#475569" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <svg fill="none" height="15" stroke="#059669" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
            <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          <strong style={{ color: "#0f172a" }}>{dateFormatted}</strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <svg fill="none" height="15" stroke="#0284c7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{timeRange}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <svg fill="none" height="15" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{locationText}</span>
        </div>
      </div>

      {/* Tujuan Peminjaman */}
      <div style={{ background: "#ffffff", borderLeft: "3px solid #cbd5e1", padding: "0.35rem 0.65rem", fontSize: "0.8125rem", color: "#334155" }}>
        <span style={{ fontWeight: 600, color: "#64748b" }}>Tujuan: </span>
        {reservation.purpose}
      </div>

      {/* Banner Urgensi SLA Petugas (Saat status PENDING) */}
      {reservation.status === "PENDING" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 0.75rem",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            background:
              sla.urgencyLevel === "danger"
                ? "#fef2f2"
                : sla.urgencyLevel === "warning"
                  ? "#fffbeb"
                  : sla.urgencyLevel === "expired"
                    ? "#450a0a"
                    : "#f0fdf4",
            color:
              sla.urgencyLevel === "danger"
                ? "#b91c1c"
                : sla.urgencyLevel === "warning"
                  ? "#b45309"
                  : sla.urgencyLevel === "expired"
                    ? "#fef2f2"
                    : "#15803d",
            border: `1px solid ${
              sla.urgencyLevel === "danger"
                ? "#fecaca"
                : sla.urgencyLevel === "warning"
                  ? "#fde68a"
                  : sla.urgencyLevel === "expired"
                    ? "#991b1b"
                    : "#bbf7d0"
            }`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <strong>{sla.remainingText}</strong>
          </div>
          <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>
            SLA Batas: {reservation.decisionDeadline ? new Date(reservation.decisionDeadline).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "--:--"} WIB
          </span>
        </div>
      ) : null}

      {/* Aset Fisik Teralokasi (Saat status APPROVED) */}
      {allocatedAssets.length > 0 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.5rem 0.75rem", borderRadius: "6px", fontSize: "0.8125rem" }}>
          <span style={{ color: "#166534", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Unit Fisik Teralokasi:</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {allocatedAssets.map((asset) => (
              <span key={asset.id} style={{ background: "#ffffff", border: "1px solid #86efac", color: "#15803d", padding: "1px 6px", borderRadius: "4px", fontWeight: 700, fontSize: "0.75rem" }}>
                {asset.assetCode ?? asset.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Catatan Alasan (Jika REJECTED / CANCELLED) */}
      {showReason ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", padding: "0.5rem 0.75rem", borderRadius: "6px", fontSize: "0.8125rem", color: "#991b1b" }}>
          <span style={{ fontWeight: 700, display: "block", marginBottom: "0.15rem" }}>
            {reservation.status === "REJECTED" ? "Alasan Penolakan:" : "Alasan Pembatalan:"}
          </span>
          <p style={{ margin: 0, lineHeight: 1.4 }}>{reservation.decisionReason}</p>
        </div>
      ) : null}

      {/* Baris Tombol Aksi Petugas */}
      <div style={{ marginTop: "auto", paddingTop: "0.75rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={() => onDetail?.(reservation)}
          style={{ padding: "0.45rem 0.85rem", fontSize: "0.8125rem", fontWeight: 600, color: "#475569", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }}
          type="button"
        >
          Lihat Rincian
        </button>

        {reservation.status === "PENDING" ? (
          <>
            <button
              onClick={() => onReject?.(reservation)}
              style={{ padding: "0.45rem 0.85rem", fontSize: "0.8125rem", fontWeight: 600, color: "#dc2626", background: "#ffffff", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer" }}
              type="button"
            >
              Tolak
            </button>
            <button
              onClick={() => onApprove?.(reservation)}
              style={{ padding: "0.45rem 1rem", fontSize: "0.8125rem", fontWeight: 600, color: "#ffffff", background: "#16a34a", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}
              type="button"
            >
              <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Setujui
            </button>
          </>
        ) : null}

        {reservation.status === "APPROVED" ? (
          <button
            onClick={() => onCancel?.(reservation)}
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.8125rem", fontWeight: 600, color: "#dc2626", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "6px", cursor: "pointer" }}
            type="button"
          >
            Batalkan Reservasi
          </button>
        ) : null}
      </div>
    </article>
  );
}
