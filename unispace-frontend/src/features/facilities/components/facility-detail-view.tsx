"use client";
/* eslint-disable react-hooks/set-state-in-effect -- availability reconciliation intentionally updates controlled quantity state. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import {
  createReservation,
  getAvailableOperationalDates,
} from "@/features/reservations/api";
import { SlotPicker } from "@/features/reservations/components/slot-picker";
import type { ReservationSummary } from "@/features/reservations/types";
import { isStaleApiError, readableApiError } from "@/lib/api/error-message";

import { type CatalogFacilityDetail, fetchFacilityDetail } from "../data/catalog-api";
import { FacilityVisual } from "./facility-card";
import type { FacilityAvailabilityData } from "@/features/reservations/types";

export function FacilityDetailView({ facilityId }: { facilityId: string }) {
  const { isReady, request, user } = useAuth();
  const [facility, setFacility] = useState<CatalogFacilityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In-page reservation booking states
  const [selectedDate, setSelectedDate] = useState<string>(
    () => getAvailableOperationalDates()[0]?.value ?? "",
  );
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null);
  const [requestedQuantity, setRequestedQuantity] = useState<number>(1);
  const [availability, setAvailability] = useState<FacilityAvailabilityData | null>(null);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [purpose, setPurpose] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shouldReloadAvailability, setShouldReloadAvailability] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<ReservationSummary | null>(null);

  const selectedQuantityMaximum = useMemo(() => {
    if (!facility || facility.kind !== "QUANTITY") return 1;
    const selectedSlots = availability?.slots.filter((slot) =>
      selectedStartTime && selectedEndTime
        ? slot.startTime >= selectedStartTime && slot.endTime <= selectedEndTime
        : false,
    ) ?? [];
    if (!selectedSlots.length) return facility.activeUnits ?? 1;
    return Math.max(1, Math.min(...selectedSlots.map((slot) => slot.availableUnits ?? 0)));
  }, [availability?.slots, facility, selectedEndTime, selectedStartTime]);
  const handleAvailabilityChange = useCallback((nextAvailability: FacilityAvailabilityData | null) => setAvailability(nextAvailability), []);

  useEffect(() => {
    setRequestedQuantity((current) => Math.min(Math.max(current, 1), selectedQuantityMaximum));
  }, [selectedQuantityMaximum]);

  useEffect(() => {
    let isMounted = true;

    fetchFacilityDetail(facilityId)
      .then((data) => {
        if (!isMounted) return;
        setFacility(data);
        setError(null);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setError(err.message || "Gagal memuat rincian fasilitas.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [facilityId]);

  function handleSlotSelect(
    startTime: string | null,
    endTime: string | null,
  ) {
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
    setSubmitError(null);
    setShouldReloadAvailability(false);
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setSelectedStartTime(null);
    setSelectedEndTime(null);
    setSubmitError(null);
    setShouldReloadAvailability(false);
  }

  function reloadAvailability() {
    setSelectedStartTime(null);
    setSelectedEndTime(null);
    setAvailability(null);
    setAvailabilityRefreshKey((current) => current + 1);
    setShouldReloadAvailability(false);
  }

  async function handleReservationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!facility || !selectedStartTime || !selectedEndTime) return;
    if (!selectedDate) {
      setSubmitError("Silakan pilih tanggal penggunaan fasilitas.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        endTime: selectedEndTime,
        facilityGroupId: facility.kind === "QUANTITY" ? facility.id : undefined,
        facilityId: facility.kind === "EXCLUSIVE" ? facility.id : undefined,
        purpose: purpose.trim() || undefined,
        requestedQuantity: facility.kind === "QUANTITY" ? requestedQuantity : 1,
        startTime: selectedStartTime,
        usageDate: selectedDate,
      };

      const result = await createReservation(payload, request);
      setSubmitSuccess(result);
    } catch (err) {
      if (isStaleApiError(err)) {
        setSelectedStartTime(null);
        setSelectedEndTime(null);
        setShouldReloadAvailability(true);
      }
      setSubmitError(readableApiError(err, "Gagal mengirim reservasi. Silakan periksa kembali data Anda."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="landing facility-detail-page">
        <div className="facility-detail-loading" role="status">
          <span className="slot-picker__spinner" />
          <span>Memuat rincian fasilitas dan jadwal…</span>
        </div>
      </main>
    );
  }

  if (error || !facility) {
    return (
      <main className="landing facility-detail-page">
        <div className="facility-detail-error">
          <h2>Fasilitas Tidak Ditemukan</h2>
          <p>{error ?? "Informasi fasilitas tidak tersedia atau telah dinonaktifkan."}</p>
          <Link className="button-primary" href="/facilities">
            Kembali ke Katalog
          </Link>
        </div>
      </main>
    );
  }

  const isMaintenance = facility.status === "MAINTENANCE";
  const capacityText =
    facility.capacity === null ? "Kapasitas fleksibel" : `${facility.capacity} orang`;
  const isUserActive =
    Boolean(isReady && user && user.role === "USER" && user.accountStatus === "ACTIVE");
  const isGuest = Boolean(isReady && !user);
  const isAccountUnverified = Boolean(isReady && user && user.accountStatus !== "ACTIVE");
  const isInteractiveMode = isUserActive && !isMaintenance;
  return (
    <main className="landing facility-detail-page">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="facility-breadcrumb">
        <Link href="/">Beranda</Link>
        <span aria-hidden="true">/</span>
        <Link href="/facilities">Katalog Fasilitas</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{facility.name}</span>
      </nav>

      <div className="facility-detail-layout">
        {/* Left Column: Profil & Informasi Fasilitas Ringkas */}
        <section className="facility-profile-card">
          <div
            aria-label={`Ilustrasi ${facility.type}`}
            className="facility-visual facility-detail-visual"
            data-theme={facility.visualTheme}
            role="img"
          >
            <FacilityVisual facility={facility} />
          </div>

          <div className="facility-profile-body">
            <div className="facility-profile-badges">
              <span className="facility-type">{facility.type}</span>
              <span
                className={`facility-status ${isMaintenance ? "facility-status--maintenance" : "facility-status--active"}`}
              >
                {isMaintenance ? "Perbaikan" : "Tersedia"}
              </span>
              <span className="facility-mode-badge">
                {facility.kind === "EXCLUSIVE" ? "Ruang Eksklusif" : "Alat"}
              </span>
            </div>

            <h1 className="facility-profile-title">{facility.name}</h1>

            <div className="facility-profile-meta">
              <div className="facility-meta-item">
                <span className="facility-meta-label">Area</span>
                <strong className="facility-meta-value">{facility.facilityArea.name}</strong>
              </div>
              <div className="facility-meta-item">
                <span className="facility-meta-label">Lokasi</span>
                <strong className="facility-meta-value">{facility.locationDetail}</strong>
              </div>
              <div className="facility-meta-item">
                <span className="facility-meta-label">Kapasitas</span>
                <strong className="facility-meta-value">{capacityText}</strong>
              </div>
              {facility.kind === "QUANTITY" && typeof facility.activeUnits === "number" ? (
                <div className="facility-meta-item">
                  <span className="facility-meta-label">Unit Aktif</span>
                  <strong className="facility-meta-value">{facility.activeUnits} unit</strong>
                </div>
              ) : null}
            </div>

            {facility.description ? (
              <p className="facility-profile-desc-clamp">{facility.description}</p>
            ) : null}
          </div>
        </section>

        {/* Right Column: Kalender Jadwal Slot 30 Menit + Panel Pemesanan In-Page */}
        <section
          aria-label="Jadwal & ketersediaan slot waktu"
          className="facility-schedule-section"
        >
          <SlotPicker
            facilityGroupId={facility.kind === "QUANTITY" ? facility.id : undefined}
            facilityId={facility.kind === "EXCLUSIVE" ? facility.id : undefined}
            initialDate={selectedDate || undefined}
            key={availabilityRefreshKey}
            mode={isInteractiveMode ? "select" : "view"}
            onDateChange={handleDateChange}
            onAvailabilityChange={handleAvailabilityChange}
            onSlotSelect={handleSlotSelect}
            requestedQuantity={requestedQuantity}
            reservationMode={facility.kind}
            selectedEndTime={selectedEndTime}
            selectedStartTime={selectedStartTime}
          />

          {/* Bottom In-Page Booking Panel */}
          {submitSuccess ? (
            <div className="facility-inpage-success">
              <div className="facility-inpage-success__header">
                <div className="facility-inpage-success__icon" aria-hidden="true">
                  <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="20">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="facility-inpage-success__title">Reservasi Berhasil Diajukan!</h3>
                  <p className="facility-inpage-success__meta">
                    No. {submitSuccess.reservationNumber ?? submitSuccess.id.slice(0, 8).toUpperCase()} · Menunggu verifikasi petugas
                  </p>
                </div>
              </div>
              <div className="facility-inpage-success__actions">
                <Link className="button-primary" href="/reservations">
                  Lihat Reservasi Saya
                </Link>
                <button
                  className="button-ghost"
                  onClick={() => {
                    setSubmitSuccess(null);
                    setSelectedStartTime(null);
                    setSelectedEndTime(null);
                    setPurpose("");
                  }}
                  type="button"
                >
                  Pesan Jadwal Lain
                </button>
              </div>
            </div>
          ) : isGuest ? (
            <div className="facility-inpage-cta">
              <div className="facility-inpage-cta__text">
                <strong>Ingin memesan fasilitas ini?</strong>
                <span>Masuk dengan akun civitas kampus untuk memilih slot waktu.</span>
              </div>
              <Link
                className="button-primary facility-inpage-cta__btn"
                href={`/login?redirect=${encodeURIComponent(`/facilities/${facility.id}`)}`}
              >
                Masuk untuk Memesan
              </Link>
            </div>
          ) : isAccountUnverified ? (
            <div className="facility-inpage-cta facility-inpage-cta--warning">
              <div className="facility-inpage-cta__text">
                <strong>Akun Belum Aktif</strong>
                <span>Selesaikan verifikasi akun untuk dapat mengajukan reservasi.</span>
              </div>
              <Link className="button-primary facility-inpage-cta__btn" href="/account-status">
                Cek Status Akun
              </Link>
            </div>
          ) : isUserActive && !isMaintenance ? (
            selectedStartTime && selectedEndTime ? (
              <form className="facility-inpage-form" onSubmit={handleReservationSubmit}>
                <div className="facility-inpage-field">
                  <label className="facility-inpage-label" htmlFor="inpage-purpose-input">
                    Tujuan Penggunaan
                  </label>
                  <textarea
                    className="facility-inpage-textarea"
                    id="inpage-purpose-input"
                    maxLength={500}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Tuliskan tujuan penggunaan fasilitas (opsional)..."
                    rows={2}
                    value={purpose}
                  />
                </div>

                <div className="facility-inpage-footer">
                  {facility.kind === "QUANTITY" ? (
                    <div className="facility-inpage-qty">
                      <label htmlFor="inpage-qty-input">Jumlah Unit:</label>
                      <input
                        id="inpage-qty-input"
                        max={selectedQuantityMaximum}
                        min={1}
                        onChange={(e) =>
                          setRequestedQuantity(
                            Math.min(selectedQuantityMaximum, Math.max(1, parseInt(e.target.value, 10) || 1)),
                          )
                        }
                        type="number"
                        value={requestedQuantity}
                      />
                      <span className="facility-inpage-qty-max">
                        / maks. {selectedQuantityMaximum} pada slot yang dipilih
                      </span>
                    </div>
                  ) : <div />}

                  <button
                    className="button-primary facility-inpage-submit-btn"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? "Mengirim…" : "Kirim Pengajuan"}
                  </button>
                </div>

                {submitError ? (
                  <div className="facility-inpage-error" role="alert">
                    {submitError}
                    {shouldReloadAvailability ? <button className="facility-inpage-error__retry" onClick={reloadAvailability} type="button">Muat ulang ketersediaan</button> : null}
                  </div>
                ) : null}
              </form>
            ) : (
              <div className="facility-inpage-hint">
                <span className="facility-inpage-hint__dot" aria-hidden="true" />
                <span>Pilih slot waktu pada kalender di atas untuk mengajukan peminjaman.</span>
              </div>
            )
          ) : isReady && user ? (
            <div className="facility-inpage-cta"><div className="facility-inpage-cta__text"><strong>Jadwal hanya untuk dilihat</strong><span>Hanya pengguna aktif yang dapat mengajukan reservasi dari katalog.</span></div></div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
