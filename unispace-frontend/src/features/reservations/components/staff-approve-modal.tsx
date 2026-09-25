"use client";

import { useEffect, useRef, useState } from "react";

import { formatDateOnlyIndonesian, formatSlotTime } from "../api";
import type { StaffReservationItem } from "../types";

export type StaffApproveModalProps = {
  error: string | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (allocatedAssetIds?: string[]) => Promise<void>;
  reservation: StaffReservationItem | null;
};

export function StaffApproveModal({
  error,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  reservation,
}: StaffApproveModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [assetInput, setAssetInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleClose() {
    if (isSubmitting) return;
    setAssetInput("");
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

  const isExclusive = Boolean(reservation.facilityId);
  const requestedQty = reservation.requestedQuantity ?? 1;

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
    setValidationError(null);

    if (isExclusive) {
      await onConfirm();
      return;
    }

    // Untuk Kelompok Alat (QUANTITY): validasi ID unit aset fisik
    const assetIds = assetInput
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter(Boolean);

    if (assetIds.length === 0) {
      setValidationError(
        `Wajib menyertakan ${requestedQty} ID unit aset fisik yang dialokasikan.`,
      );
      return;
    }

    if (assetIds.length !== requestedQty) {
      setValidationError(
        `Jumlah aset fisik yang dimasukkan (${assetIds.length}) harus sama dengan kuantitas yang diajukan (${requestedQty}).`,
      );
      return;
    }

    const uniqueIds = new Set(assetIds);
    if (uniqueIds.size !== assetIds.length) {
      setValidationError("Terdapat duplikasi ID aset dalam daftar alokasi.");
      return;
    }

    await onConfirm(assetIds);
  }

  return (
    <div
      aria-labelledby="approve-modal-title"
      aria-modal="true"
      className="reservation-modal-backdrop"
      role="dialog"
    >
      <div
        className="reservation-modal-overlay"
        onClick={handleClose}
      />

      <div className="reservation-modal-card" ref={modalRef} style={{ maxWidth: "560px" }}>
        <div className="reservation-modal-header" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#16a34a",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="20">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="approve-modal-title" style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Persetujuan Reservasi
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "2px 0 0" }}>
              Verifikasi permohonan dan alokasikan jadwal fasilitas secara atomik.
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
            {/* Rincian Permohonan */}
            <div style={{ background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Target Fasilitas:</span>
                <strong style={{ color: "#0f172a" }}>{targetName}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Pemohon:</span>
                <span style={{ color: "#1e293b", fontWeight: 600 }}>{reservation.user.name} ({reservation.user.identityNumber})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Jadwal:</span>
                <span style={{ color: "#1e293b" }}>{dateFormatted}, {timeRange}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Mode Peminjaman:</span>
                <span style={{ color: isExclusive ? "#4338ca" : "#b45309", fontWeight: 700 }}>
                  {isExclusive ? "Ruang Eksklusif" : `Kelompok Alat (${requestedQty} Unit)`}
                </span>
              </div>
            </div>

            {/* Input Alokasi Unit Fisik (Khusus Kelompok Alat QUANTITY) */}
            {!isExclusive ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor="allocated-assets-input" style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>
                  Alokasi ID Unit Aset Fisik (Wajib {requestedQty} unit):
                </label>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  Masukkan ID aset unit fisik dari inventaris kampus, pisahkan dengan koma atau baris baru:
                </p>
                <textarea
                  id="allocated-assets-input"
                  disabled={isSubmitting}
                  onChange={(e) => setAssetInput(e.target.value)}
                  placeholder="Contoh: 30000000-0000-4000-8000-000000000001, 30000000-0000-4000-8000-000000000002"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.8125rem",
                    fontFamily: "monospace",
                  }}
                  value={assetInput}
                />
              </div>
            ) : null}

            {/* Alert Konsekuensi Persetujuan */}
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "6px", fontSize: "0.8125rem", color: "#166534" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16" style={{ flexShrink: 0, marginTop: "2px" }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                <span>
                  {isExclusive
                    ? "Persetujuan ini akan mengunci slot secara atomik. Pengajuan PENDING lain yang bertabrakan pada rentang waktu ini akan otomatis ditolak oleh sistem (cascade auto-reject)."
                    : "Persetujuan ini akan mengunci unit aset fisik dan mengalokasikannya ke tiket pemohon. Pengajuan lain yang kekurangan stok akan otomatis ditolak oleh sistem."}
                </span>
              </div>
            </div>

            {/* Pesan Kesalahan */}
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
                background: isSubmitting ? "#86efac" : "#16a34a",
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
                  <span>Memproses…</span>
                </>
              ) : (
                "Konfirmasi & Setujui"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
