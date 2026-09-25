"use client";

import { useEffect, useRef } from "react";

import {
  formatDateOnlyIndonesian,
  formatSlotTime,
  getReservationStatusConfig,
  getSlaUrgencyStatus,
} from "../api";
import type { StaffReservationItem } from "../types";

export type StaffDetailModalProps = {
  isOpen: boolean;
  onApprove?: (reservation: StaffReservationItem) => void;
  onCancel?: (reservation: StaffReservationItem) => void;
  onClose: () => void;
  onReject?: (reservation: StaffReservationItem) => void;
  reservation: StaffReservationItem | null;
};

export function StaffDetailModal({
  isOpen,
  onApprove,
  onCancel,
  onClose,
  onReject,
  reservation,
}: StaffDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !reservation) return null;

  const statusConfig = getReservationStatusConfig(reservation.status);

  const targetName =
    reservation.facility?.name ??
    reservation.facilityGroup?.name ??
    "Fasilitas Kampus";

  const isExclusive = Boolean(reservation.facilityId);
  const areaName =
    reservation.facility?.facilityGroup?.facilityArea?.name ??
    reservation.facilityGroup?.facilityArea?.name;
  const locationDetail =
    reservation.facility?.facilityGroup?.locationDetail ??
    reservation.facilityGroup?.locationDetail;

  const usageDateOnly = reservation.usageDate.split("T")[0] ?? "";
  const dateFormatted = formatDateOnlyIndonesian(usageDateOnly);
  const timeRange = `${formatSlotTime(reservation.startTime)} – ${formatSlotTime(reservation.endTime)} WIB`;

  const sla = getSlaUrgencyStatus(reservation.decisionDeadline);
  const allocatedAssets = reservation.allocatedAssets ?? [];

  return (
    <div
      aria-labelledby="detail-modal-title"
      aria-modal="true"
      className="reservation-modal-backdrop"
      role="dialog"
    >
      <div className="reservation-modal-overlay" onClick={onClose} />

      <div className="reservation-modal-card" ref={modalRef} style={{ maxWidth: "600px" }}>
        <div className="reservation-modal-header" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className={`user-res-badge ${statusConfig.badgeClass}`}>
                <span className="user-res-badge__dot" aria-hidden="true" />
                <span>{statusConfig.label}</span>
              </span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                ID: {reservation.id}
              </span>
            </div>
            <h2 id="detail-modal-title" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              {targetName}
            </h2>
          </div>

          <button
            aria-label="Tutup jendela"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "1.5rem", color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}
            type="button"
          >
            ×
          </button>
        </div>

        <div style={{ padding: "1.25rem 0", display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "70vh", overflowY: "auto" }}>
          {/* Section: Pemohon */}
          <div>
            <h4 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 0.5rem", letterSpacing: "0.05em" }}>
              Identitas Pemohon
            </h4>
            <div style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.875rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Nama Lengkap</span>
                <strong style={{ color: "#0f172a" }}>{reservation.user.name}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>NIM / NIP</span>
                <span style={{ color: "#1e293b" }}>{reservation.user.identityNumber}</span>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Email Institusi</span>
                <span style={{ color: "#1e293b" }}>{reservation.user.email}</span>
              </div>
            </div>
          </div>

          {/* Section: Jadwal & Fasilitas */}
          <div>
            <h4 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 0.5rem", letterSpacing: "0.05em" }}>
              Jadwal & Target Fasilitas
            </h4>
            <div style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.875rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Tanggal Pemakaian</span>
                <strong style={{ color: "#0f172a" }}>{dateFormatted}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Waktu Slot</span>
                <span style={{ color: "#1e293b" }}>{timeRange}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Mode & Kuantitas</span>
                <span style={{ color: isExclusive ? "#4338ca" : "#b45309", fontWeight: 600 }}>
                  {isExclusive ? "Ruang Eksklusif" : `Kelompok Alat (${reservation.requestedQuantity} Unit)`}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Area & Gedung</span>
                <span style={{ color: "#1e293b" }}>
                  {areaName ?? "-"} {locationDetail ? `(${locationDetail})` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Tujuan Peminjaman */}
          <div>
            <h4 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 0.5rem", letterSpacing: "0.05em" }}>
              Tujuan Kegiatan
            </h4>
            <div style={{ background: "#ffffff", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.875rem", color: "#334155", lineHeight: 1.5 }}>
              {reservation.purpose}
            </div>
          </div>

          {/* Section: SLA & Keputusan */}
          <div>
            <h4 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 0.5rem", letterSpacing: "0.05em" }}>
              Status Evaluasi & Audit
            </h4>
            <div style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Tenggat Keputusan SLA:</span>
                <span style={{ fontWeight: 600, color: sla.urgencyLevel === "danger" || sla.urgencyLevel === "expired" ? "#dc2626" : "#1e293b" }}>
                  {reservation.decisionDeadline ? new Date(reservation.decisionDeadline).toLocaleString("id-ID") : "-"} ({sla.remainingText})
                </span>
              </div>

              {reservation.decidedAt ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Diputuskan Pada:</span>
                  <span style={{ color: "#1e293b" }}>{new Date(reservation.decidedAt).toLocaleString("id-ID")}</span>
                </div>
              ) : null}

              {reservation.processedBy ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Diproses Oleh:</span>
                  <span style={{ color: "#1e293b" }}>{reservation.processedBy.name} ({reservation.processedBy.email})</span>
                </div>
              ) : null}

              {allocatedAssets.length > 0 ? (
                <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#166534", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Unit Fisik Teralokasi:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {allocatedAssets.map((asset) => (
                      <span key={asset.id} style={{ background: "#ffffff", border: "1px solid #86efac", color: "#15803d", padding: "2px 8px", borderRadius: "4px", fontWeight: 700, fontSize: "0.75rem" }}>
                        {asset.assetCode ?? asset.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {reservation.decisionReason ? (
                <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#dc2626", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Alasan Keputusan:</span>
                  <div style={{ background: "#fef2f2", padding: "0.5rem 0.75rem", borderRadius: "6px", color: "#991b1b", fontSize: "0.8125rem" }}>
                    {reservation.decisionReason}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={onClose}
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569", background: "#f1f5f9", border: "none", borderRadius: "6px", cursor: "pointer" }}
            type="button"
          >
            Tutup
          </button>

          {reservation.status === "PENDING" ? (
            <>
              <button
                onClick={() => {
                  onClose();
                  onReject?.(reservation);
                }}
                style={{ padding: "0.5rem 1.15rem", fontSize: "0.875rem", fontWeight: 600, color: "#dc2626", background: "#ffffff", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer" }}
                type="button"
              >
                Tolak Permohonan
              </button>
              <button
                onClick={() => {
                  onClose();
                  onApprove?.(reservation);
                }}
                style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff", background: "#16a34a", border: "none", borderRadius: "6px", cursor: "pointer" }}
                type="button"
              >
                Setujui Permohonan
              </button>
            </>
          ) : null}

          {reservation.status === "APPROVED" ? (
            <button
              onClick={() => {
                onClose();
                onCancel?.(reservation);
              }}
              style={{ padding: "0.5rem 1.15rem", fontSize: "0.875rem", fontWeight: 600, color: "#e11d48", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "6px", cursor: "pointer" }}
              type="button"
            >
              Batalkan Reservasi Ini
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
