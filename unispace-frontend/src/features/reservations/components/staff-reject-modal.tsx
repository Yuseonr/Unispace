"use client";

import { useEffect, useRef, useState } from "react";

import { formatDateOnlyIndonesian, formatSlotTime } from "../api";
import type { StaffReservationItem } from "../types";

export type StaffRejectModalProps = {
  error: string | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  reservation: StaffReservationItem | null;
};

export function StaffRejectModal({
  error,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  reservation,
}: StaffRejectModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleClose() {
    if (isSubmitting) return;
    setReason("");
    setValidationError(null);
    onClose();
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !reservation) return null;

  const targetName =
    reservation.facility?.name ??
    reservation.facilityGroup?.name ??
    "Fasilitas Kampus";

  const dateFormatted = formatDateOnlyIndonesian(
    reservation.usageDate.split("T")[0] ?? "",
  );
  const timeRange = `${formatSlotTime(reservation.startTime)} – ${formatSlotTime(reservation.endTime)} WIB`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();

    if (trimmed.length < 5) {
      setValidationError("Alasan penolakan wajib diisi minimal 5 karakter.");
      return;
    }

    if (trimmed.length > 500) {
      setValidationError("Alasan penolakan maksimal 500 karakter.");
      return;
    }

    setValidationError(null);
    await onConfirm(trimmed);
  }

  return (
    <div
      aria-labelledby="reject-modal-title"
      aria-modal="true"
      className="reservation-modal-backdrop"
      role="dialog"
    >
      <div
        className="reservation-modal-overlay"
        onClick={handleClose}
      />

      <div className="reservation-modal-card" ref={modalRef} style={{ maxWidth: "520px" }}>
        <div className="reservation-modal-header" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#dc2626",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" x2="9" y1="9" y2="15" />
              <line x1="9" x2="15" y1="9" y2="15" />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="reject-modal-title" style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Tolak Permohonan Reservasi
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0" }}>
              Berikan alasan penolakan yang transparan untuk pemohon.
            </p>
          </div>

          <button
            aria-label="Tutup jendela"
            disabled={isSubmitting}
            onClick={handleClose}
            style={{ background: "none", border: "none", fontSize: "1.5rem", color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "1.25rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8125rem", color: "#475569" }}>
              <div><strong>{targetName}</strong> ({dateFormatted}, {timeRange})</div>
              <div>Pemohon: <strong>{reservation.user.name}</strong> ({reservation.user.identityNumber})</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="rejection-reason" style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>
                  Alasan Penolakan <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <span style={{ fontSize: "0.75rem", color: reason.trim().length < 5 ? "#dc2626" : "#64748b" }}>
                  {reason.length} / 500 karakter
                </span>
              </div>
              <textarea
                id="rejection-reason"
                disabled={isSubmitting}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tuliskan alasan penolakan secara jelas (misal: Ruangan sedang dipersiapkan untuk acara universitas / berkas tujuan belum sesuai)..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                }}
                value={reason}
              />
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                Catatan alasan penolakan ini akan dicatat ke dalam audit log dan dapat dibaca oleh pemohon.
              </p>
            </div>

            {validationError || error ? (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "0.6rem 0.85rem", borderRadius: "6px", fontSize: "0.8125rem", color: "#b91c1c" }}>
                {validationError ?? error}
              </div>
            ) : null}
          </div>

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button
              disabled={isSubmitting}
              onClick={handleClose}
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "#475569", background: "#f1f5f9", border: "none", borderRadius: "6px", cursor: "pointer" }}
              type="button"
            >
              Batal
            </button>
            <button
              disabled={isSubmitting}
              style={{
                padding: "0.5rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#ffffff",
                background: isSubmitting ? "#fca5a5" : "#dc2626",
                border: "none",
                borderRadius: "6px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin" height="14" viewBox="0 0 24 24" width="14" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Menolak…</span>
                </>
              ) : (
                "Konfirmasi Penolakan"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
