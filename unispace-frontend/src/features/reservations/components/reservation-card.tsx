"use client";

import {
  formatDateIndonesian,
  formatDateOnlyIndonesian,
  formatSlotTime,
  getReservationStatusConfig,
} from "../api";
import type { UserReservationItem } from "../types";

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

  const isExclusive = Boolean(reservation.facilityId);
  const modeText = isExclusive
    ? "Ruang Eksklusif"
    : `Alat (${reservation.requestedQuantity} unit)`;

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

  const createdDateFormatted = formatDateOnlyIndonesian(
    reservation.createdAt.split("T")[0] ?? "",
  );

  const shortCode = `#RES-${reservation.id.slice(0, 8).toUpperCase()}`;

  const hasAllocatedAssets =
    reservation.status === "APPROVED" &&
    reservation.allocatedAssets &&
    reservation.allocatedAssets.length > 0;

  return (
    <article className="user-res-card" data-status={reservation.status}>
      {/* Header Kartu: Kode Tiket, Tanggal Dibuat, & Badge Status */}
      <header className="user-res-card__header">
        <div className="user-res-card__meta">
          <span className="user-res-card__code">{shortCode}</span>
          <span className="user-res-card__dot" aria-hidden="true">·</span>
          <span className="user-res-card__created">Diajukan {createdDateFormatted}</span>
        </div>

        <span
          className={`user-res-badge ${statusConfig.badgeClass}`}
          title={statusConfig.description}
        >
          <span className="user-res-badge__dot" aria-hidden="true" />
          <span>{statusConfig.label}</span>
        </span>
      </header>

      {/* Body Kartu: Nama Fasilitas, Tipe/Kuantitas, Lokasi, Jadwal, & Tujuan */}
      <div className="user-res-card__body">
        <div className="user-res-card__primary">
          <div className="user-res-card__title-row">
            <h3 className="user-res-card__title">{targetName}</h3>
            <span className="user-res-card__mode">{modeText}</span>
          </div>

          <div className="user-res-card__info-row">
            <div className="user-res-card__info-item">
              <span className="user-res-card__info-icon" aria-hidden="true">
                <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span>{locationText}</span>
            </div>

            <div className="user-res-card__info-item">
              <span className="user-res-card__info-icon" aria-hidden="true">
                <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
                  <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </span>
              <strong>{dateFormatted}</strong>
              <span className="user-res-card__time">({timeRange})</span>
            </div>
          </div>
        </div>

        {/* Tujuan Penggunaan */}
        {reservation.purpose ? (
          <div className="user-res-card__purpose">
            <span className="user-res-card__purpose-label">Tujuan:</span>
            <p className="user-res-card__purpose-text">{reservation.purpose}</p>
          </div>
        ) : null}

        {/* Informasi Kontekstual Sesuai Status */}
        {reservation.status === "PENDING" && reservation.decisionDeadline ? (
          <div className="user-res-card__alert user-res-card__alert--pending">
            <span className="user-res-card__alert-icon" aria-hidden="true">⏱</span>
            <div>
              <strong>Tenggat Keputusan Petugas (SLA)</strong>
              <p>
                Petugas akan memutuskan paling lambat sebelum{" "}
                <strong>
                  {formatDateIndonesian(reservation.decisionDeadline.split("T")[0] ?? "")} pukul 20.00 WIB
                </strong>
                .
              </p>
            </div>
          </div>
        ) : null}

        {hasAllocatedAssets ? (
          <div className="user-res-card__alert user-res-card__alert--approved">
            <span className="user-res-card__alert-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Unit Fisik Teralokasi</strong>
              <div className="user-res-card__assets-tags">
                {reservation.allocatedAssets.map((asset) => (
                  <span className="user-res-card__asset-tag" key={asset.id}>
                    {asset.assetCode || asset.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : reservation.status === "APPROVED" && reservation.facility?.assetCode ? (
          <div className="user-res-card__alert user-res-card__alert--approved">
            <span className="user-res-card__alert-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Ruangan Terjadwal:</strong> {reservation.facility.assetCode}
            </div>
          </div>
        ) : null}

        {(reservation.status === "REJECTED" ||
          reservation.status === "CANCELLED_BY_STAFF" ||
          reservation.status === "CANCELLED_BY_SYSTEM") &&
        reservation.decisionReason ? (
          <div className="user-res-card__alert user-res-card__alert--rejected">
            <span className="user-res-card__alert-icon" aria-hidden="true">!</span>
            <div>
              <strong>Alasan Penolakan/Pembatalan:</strong>
              <p>{reservation.decisionReason}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer Kartu: Aksi Batal Mandiri & Keterangan Aturan */}
      <footer className="user-res-card__footer">
        {reservation.canCancel ? (
          <div className="user-res-card__action-block">
            <button
              className="button-ghost-danger user-res-card__cancel-btn"
              onClick={() => onCancelClick?.(reservation)}
              type="button"
            >
              Batalkan Reservasi
            </button>
            <span className="user-res-card__action-hint">
              Dapat dibatalkan mandiri s.d. H-1 pukul 20.00 WIB
            </span>
          </div>
        ) : reservation.status === "PENDING" || reservation.status === "APPROVED" ? (
          <span className="user-res-card__action-cutoff-note">
            Batas pembatalan mandiri telah terlewati (maksimal H-1 pukul 20.00 WIB).
          </span>
        ) : reservation.status.startsWith("CANCELLED") && reservation.cancelledAt ? (
          <span className="user-res-card__action-cutoff-note">
            Dibatalkan pada {formatDateIndonesian(reservation.cancelledAt.split("T")[0] ?? "")}
          </span>
        ) : (
          <div />
        )}
      </footer>
    </article>
  );
}
