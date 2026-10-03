"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from "@/components/ui/page-primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { fetchPublicCatalog } from "../data/catalog-api";
import type { CatalogFacility } from "../types";
import { FacilityCard } from "./facility-card";
import { createDirectFacilityMaintenance, previewDirectFacilityMaintenance, type MaintenanceImpactResponse } from "../data/staff-maintenance-api";

function SearchIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TIME_OPTIONS = Array.from({ length: 27 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

export function StaffFacilityCatalog() {
  const router = useRouter();
  const { request } = useAuth();
  const [facilities, setFacilities] = useState<CatalogFacility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [searchDraft, setSearchDraft] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(1);

  // Modal State
  const [selectedFacility, setSelectedFacility] = useState<CatalogFacility | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Form State
  const [mode, setMode] = useState<"DATE_RANGE" | "TIME_RANGE">("DATE_RANGE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  
  // Preview State
  const [impact, setImpact] = useState<MaintenanceImpactResponse | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchPublicCatalog({ search: activeSearch || undefined, page })
      .then((catalog) => {
        if (!active) return;
        setFacilities(catalog.facilities);
        setMeta({ page: catalog.page, total: catalog.total, totalPages: Math.max(1, catalog.totalPages) });
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal memuat fasilitas.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeSearch, page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveSearch(searchDraft);
    setPage(1);
  }
  
  function resetModal() {
    setSelectedFacility(null);
    setStep(1);
    setMode("DATE_RANGE");
    setStartDate("");
    setEndDate("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setNote("");
    setImpact(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }

  async function handlePreviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacility) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        mode,
        startDate: mode === "DATE_RANGE" ? startDate : undefined,
        endDate: mode === "DATE_RANGE" ? endDate : undefined,
        date: mode === "TIME_RANGE" ? date : undefined,
        startTime: mode === "TIME_RANGE" ? startTime : undefined,
        endTime: mode === "TIME_RANGE" ? endTime : undefined,
        note,
      };
      const res = await previewDirectFacilityMaintenance(request, selectedFacility.id, payload);
      setImpact(res);
      setStep(2);
    } catch (err: any) {
      setSubmitError(err.message || "Gagal mempratinjau jadwal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacility) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        mode,
        startDate: mode === "DATE_RANGE" ? startDate : undefined,
        endDate: mode === "DATE_RANGE" ? endDate : undefined,
        date: mode === "TIME_RANGE" ? date : undefined,
        startTime: mode === "TIME_RANGE" ? startTime : undefined,
        endTime: mode === "TIME_RANGE" ? endTime : undefined,
        note,
        cancellationReason: note,
        cancelImpactedReservations: true,
      };
      await createDirectFacilityMaintenance(request, selectedFacility.id, payload);
      router.push(`/staff/maintenance`);
      resetModal();
    } catch (err: any) {
      setSubmitError(err.message || "Gagal menyimpan jadwal perbaikan.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-page">
      <PageHeader 
        eyebrow="Operasional" 
        title="Katalog Fasilitas"
      >
        Pilih fasilitas dari katalog untuk menjadwalkan penutupan (maintenance).
      </PageHeader>

      <form 
        onSubmit={handleSearch} 
        style={{ 
          display: "flex", 
          gap: "0.75rem", 
          width: "100%", 
          margin: "1.25rem 0 1.5rem" 
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <span 
            style={{ 
              position: "absolute", 
              left: "14px", 
              top: "50%", 
              transform: "translateY(-50%)", 
              color: "#64748b", 
              width: "18px", 
              height: "18px", 
              display: "flex", 
              pointerEvents: "none" 
            }}
          >
            <SearchIcon />
          </span>
          <input
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Cari nama fasilitas, lokasi, atau area..."
            type="search"
            value={searchDraft}
            style={{ 
              width: "100%", 
              padding: "0.7rem 0.85rem 0.7rem 2.5rem", 
              borderRadius: "8px", 
              border: "1px solid #cbd5e1", 
              fontSize: "0.875rem", 
              background: "#fff",
              outline: "none"
            }}
          />
        </div>
        <button 
          className="button-primary" 
          type="submit" 
          style={{ whiteSpace: "nowrap", padding: "0.7rem 1.5rem", borderRadius: "8px" }}
        >
          Cari
        </button>
      </form>

      <section className="ui-surface" style={{ padding: "clamp(1rem, 3vw, 2rem)" }}>
        {isLoading ? (
          <LoadingState label="Mencari fasilitas..." />
        ) : error ? (
          <ErrorState error={error} onRetry={() => setPage(page)} />
        ) : facilities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#64748b" }}>
            Tidak ada fasilitas yang sesuai dengan pencarian Anda.
          </div>
        ) : (
          <>
            <div className="facility-grid">
              {facilities.map((fac) => (
                <FacilityCard key={fac.id} facility={fac} onClick={() => setSelectedFacility(fac)} />
              ))}
            </div>
            {meta.totalPages > 1 && (
              <div style={{ marginTop: "2rem" }}>
                <Pagination onPageChange={setPage} page={meta.page} total={meta.total} totalPages={meta.totalPages} />
              </div>
            )}
          </>
        )}
      </section>

      {selectedFacility && (
        <div 
          className="ui-dialog-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) resetModal();
          }}
          role="presentation"
        >
          <div aria-modal="true" className="ui-dialog" role="dialog" tabIndex={-1}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: "0 0 0.25rem 0" }}>{step === 1 ? "Penjadwalan Perbaikan" : "Konfirmasi Dampak"}</h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.82rem" }}>
                  {step === 1 ? "Jadwalkan penutupan untuk fasilitas ini" : "Periksa reservasi yang akan dibatalkan"}
                </p>
              </div>
              <button
                aria-label="Tutup dialog"
                disabled={isSubmitting}
                onClick={resetModal}
                style={{ 
                  background: "transparent", 
                  border: 0, 
                  fontSize: "1.35rem", 
                  cursor: "pointer", 
                  color: "#64748b", 
                  lineHeight: 1, 
                  padding: "0.2rem 0.4rem" 
                }}
                type="button"
              >
                &times;
              </button>
            </div>

            {step === 1 ? (
              <form onSubmit={handlePreviewSubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ padding: "0.85rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", color: "#1e293b", fontWeight: 600 }}>{selectedFacility.name}</h3>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                    {selectedFacility.facilityArea.name} &bull; {selectedFacility.locationDetail}
                  </p>
                </div>

                {submitError && <p className="ui-dialog__error" role="alert">{submitError}</p>}
                
                <label className="ui-field" style={{ display: "grid", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Mode Penutupan</span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => setMode("DATE_RANGE")}
                      className={mode === "DATE_RANGE" ? "button-primary" : "admin-secondary-button"}
                      style={{ flex: 1, padding: "0.5rem", borderRadius: "6px" }}
                    >
                      Harian (Penuh)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("TIME_RANGE")}
                      className={mode === "TIME_RANGE" ? "button-primary" : "admin-secondary-button"}
                      style={{ flex: 1, padding: "0.5rem", borderRadius: "6px" }}
                    >
                      Jam Spesifik
                    </button>
                  </div>
                </label>

                {mode === "DATE_RANGE" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <label className="ui-field" style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Tanggal Mulai</span>
                      <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="ui-input" />
                    </label>
                    <label className="ui-field" style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Tanggal Selesai</span>
                      <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="ui-input" />
                    </label>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                    <label className="ui-field" style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Tanggal</span>
                      <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="ui-input" />
                    </label>
                    <label className="ui-field" style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Jam Mulai</span>
                      <select required value={startTime} onChange={e => setStartTime(e.target.value)} className="ui-input">
                        <option value="" disabled>Pilih Jam</option>
                        {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                    </label>
                    <label className="ui-field" style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Jam Selesai</span>
                      <select required value={endTime} onChange={e => setEndTime(e.target.value)} className="ui-input">
                        <option value="" disabled>Pilih Jam</option>
                        {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                    </label>
                  </div>
                )}

                <label className="ui-field" style={{ display: "grid", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Alasan / Catatan Penutupan</span>
                  <textarea 
                    disabled={isSubmitting} 
                    onChange={(e) => setNote(e.target.value)} 
                    placeholder="Contoh: Pembersihan berkala, perbaikan AC..." 
                    required 
                    rows={3} 
                    className="ui-input"
                    value={note} 
                  />
                </label>

                <footer>
                  <button disabled={isSubmitting} onClick={resetModal} type="button">
                    Batal
                  </button>
                  <button disabled={isSubmitting} type="submit" className="button-primary">
                    {isSubmitting ? "Memproses..." : "Pratinjau Dampak"}
                  </button>
                </footer>
              </form>
            ) : (
              <form onSubmit={handleConfirmSubmit} style={{ display: "grid", gap: "1rem" }}>
                <div style={{ padding: "0.85rem", background: "#fffbeb", borderRadius: "8px", border: "1px solid #fde68a" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e" }}>
                    Terdapat <strong>{impact?.approvedReservations.length}</strong> reservasi disetujui dan <strong>{impact?.pendingReservations.length}</strong> reservasi tertunda yang terdampak (bertabrakan) dengan jadwal ini. Semua reservasi ini akan dibatalkan otomatis dengan catatan: "{note}".
                  </p>
                </div>
                
                {submitError && <p className="ui-dialog__error" role="alert">{submitError}</p>}
                
                <footer>
                  <button disabled={isSubmitting} onClick={() => setStep(1)} type="button">
                    Kembali
                  </button>
                  <button disabled={isSubmitting} type="submit" className="button-primary">
                    {isSubmitting ? "Menyimpan..." : "Lanjutkan & Batalkan Reservasi"}
                  </button>
                </footer>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
