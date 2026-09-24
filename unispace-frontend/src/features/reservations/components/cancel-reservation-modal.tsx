"use client";

import { useEffect, useRef } from "react";

import { formatDateOnlyIndonesian, formatSlotTime } from "../api";
import type { UserReservationItem } from "../types";

export type CancelReservationModalProps = {
  error: string | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  reservation: UserReservationItem | null;
};

export function CancelReservationModal({
  error,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  reservation,
}: CancelReservationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      aria-labelledby="cancel-modal-title"
      aria-modal="true"
      className="reservation-modal-backdrop"
      role="dialog"
    >
      <div
        className="reservation-modal-overlay"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />

      <div className="reservation-modal-card" ref={modalRef}>
        <div className="reservation-modal-header">
          <div className="reservation-modal-header__icon" aria-hidden="true">
            <svg fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" x2="9" y1="9" y2="15" />
              <line x1="9" x2="15" y1="9" y2="15" />
            </svg>
          </div>

          <div className="reservation-modal-header__text">
            <h2 className="reservation-modal-title" id="cancel-modal-title">
              Batalkan Reservasi?
            </h2>
            <p className="reservation-modal-subtitle">
              Tindakan ini tidak dapat dibatalkan setelah dikonfirmasi.
            </p>
          </div>

          <button
            aria-label="Tutup jendela"
            className="reservation-modal-close"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="reservation-modal-body">
          <div className="reservation-modal-summary">
            <div className="reservation-modal-summary__row">
              <span className="reservation-modal-summary__label">Fasilitas:</span>
              <strong className="reservation-modal-summary__value">{targetName}</strong>
            </div>

            <div className="reservation-modal-summary__row">
              <span className="reservation-modal-summary__label">Jadwal:</span>
              <span className="reservation-modal-summary__value">
                {dateFormatted} ({timeRange})
              </span>
            </div>

            {reservation.facilityGroupId && reservation.requestedQuantity > 1 ? (
              <div className="reservation-modal-summary__row">
                <span className="reservation-modal-summary__label">Jumlah Unit:</span>
                <span className="reservation-modal-summary__value">
                  {reservation.requestedQuantity} unit
                </span>
              </div>
            ) : null}
          </div>

          <div className="reservation-modal-notice">
            <span className="reservation-modal-notice__icon" aria-hidden="true">ℹ</span>
            <p className="reservation-modal-notice__text">
              Pembatalan mandiri hanya berlaku sebelum <strong>pukul 20.00 WIB pada H-1 hari kerja operasional</strong>. Setelah dibatalkan, slot waktu akan langsung tersedia kembali untuk pemohon lain.
            </p>
          </div>

          {error ? (
            <div className="reservation-modal-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="reservation-modal-footer">
          <button
            className="button-ghost reservation-modal-cancel-btn"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Kembali
          </button>

          <button
            className="button-danger reservation-modal-confirm-btn"
            disabled={isSubmitting}
            onClick={() => void onConfirm()}
            type="button"
          >
            {isSubmitting ? (
              <>
                <span className="slot-picker__spinner" aria-hidden="true" />
                <span>Membatalkan…</span>
              </>
            ) : (
              "Ya, Batalkan Reservasi"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
