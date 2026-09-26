"use client";

import {
  formatDateOnlyIndonesian,
  formatSlotTime,
  getReservationStatusConfig,
} from "../api";
import type { UserReservationItem } from "../types";
import { displayOptionalText, formatJakartaDateTime } from "@/lib/format";

export type ReservationCardProps = {
  onCancelClick?: (reservation: UserReservationItem) => void;
  reservation: UserReservationItem;
};

export function ReservationCard({
  onCancelClick,
  reservation,
}: ReservationCardProps) {
  const statusConfig = getReservationStatusConfig(reservation.status);

  const targetName =
    reservation.facility?.name ??
    reservation.facilityGroup?.name ??
    "Fasilitas Kampus";

  const areaName =
    reservation.facility?.facilityGroup?.facilityArea?.name ??
    reservation.facilityGroup?.facilityArea?.name;
  const locationDetail =
    reservation.facility?.facilityGroup?.locationDetail ??
    reservation.facilityGroup?.locationDetail;
  const locationText =
    areaName && locationDetail
      ? `${areaName} · ${locationDetail}`
      : areaName ?? locationDetail ?? "Kampus Unispace";

  const usageDateOnly = reservation.usageDate.split("T")[0] ?? "";
  const dateFormatted = formatDateOnlyIndonesian(usageDateOnly);
  const timeRange = `${formatSlotTime(reservation.startTime)} – ${formatSlotTime(reservation.endTime)} WIB`;
  const isQuantity = Boolean(reservation.facilityGroupId);

  const showRejectionReason =
    (reservation.status === "REJECTED" ||
      reservation.status === "CANCELLED_BY_STAFF" ||
      reservation.status === "CANCELLED_BY_SYSTEM") &&
    Boolean(reservation.decisionReason);

  return (
    <article className="user-res-card" data-status={reservation.status}>
      {/* Baris Atas: Judul Fasilitas Sejajar dengan Status Badge & Tombol Batal */}
      <div className="user-res-card__top">
        <h3 className="user-res-card__title">{targetName}</h3>

        <div className="user-res-card__actions">
          <span
            className={`user-res-badge ${statusConfig.badgeClass}`}
            title={statusConfig.description}
          >
            <span className="user-res-badge__dot" aria-hidden="true" />
            <span>{statusConfig.label}</span>
          </span>

          {reservation.canCancel ? (
            <button
              className="user-res-card__cancel-btn-compact"
              onClick={() => onCancelClick?.(reservation)}
              title="Batalkan reservasi ini"
              type="button"
            >
              Batalkan
            </button>
          ) : null}
        </div>
      </div>
      <p className="user-res-card__number">{reservation.reservationNumber}</p>

      {/* Baris Informasi Detail: Jadwal & Lokasi yang Sejajar */}
      <div className="user-res-card__details">
        <div className="user-res-card__detail-item">
          <span className="user-res-card__detail-icon" aria-hidden="true">
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
              <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </span>
          <strong className="user-res-card__date-strong">{dateFormatted}</strong>
          <span className="user-res-card__time-span">· {timeRange}</span>
        </div>

        <div className="user-res-card__detail-item">
          <span className="user-res-card__detail-icon" aria-hidden="true">
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span>{locationText}</span>
        </div>
        <div className="user-res-card__detail-item">
          <span className="user-res-card__detail-icon" aria-hidden="true">#</span>
          <span>{isQuantity ? `Kelompok alat · ${reservation.requestedQuantity} unit` : "Ruang eksklusif"}</span>
        </div>
      </div>

      <div className="user-res-card__note">
        <span className="user-res-card__note-label">Keperluan:</span>
        <span className="user-res-card__note-val">{displayOptionalText(reservation.purpose)}</span>
      </div>

      {reservation.status === "PENDING" ? <div className="user-res-card__note"><span className="user-res-card__note-label">Batas keputusan:</span><span className="user-res-card__note-val">{formatJakartaDateTime(reservation.decisionDeadline)}</span></div> : null}

      {reservation.allocatedAssets.length ? <div className="user-res-card__note"><span className="user-res-card__note-label">Aset dialokasikan:</span><span className="user-res-card__note-val">{reservation.allocatedAssets.map((asset) => asset.assetCode ?? asset.name).join(", ")}</span></div> : null}

      {/* Alasan Penolakan / Pembatalan Staf (jika ada) */}
      {showRejectionReason ? (
        <div className="user-res-card__note user-res-card__note--rejected">
          <span className="user-res-card__note-label">Alasan Petugas:</span>
          <span className="user-res-card__note-val">{reservation.decisionReason}</span>
        </div>
      ) : null}
    </article>
  );
}
