"use client";
/* eslint-disable @next/next/no-img-element -- private image endpoint is dynamic and also previews object URLs. */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import {
  apiErrorMessage,
  type AdminFacilityGroup,
  type FacilityUnitStatus,
} from "@/features/facilities/admin-types";

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.4 15.4 4.1 4.1" /></svg>;
}

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16.5-.7 4.2 4.2-.7L19 8.5 15.5 5zM13.9 6.6l3.5 3.5" /></svg>;
}

function FacilityPlaceholder() {
  return <svg aria-hidden="true" className="admin-facility-placeholder" viewBox="0 0 24 24"><path d="M4 20V5h10v15M15 10h4v10M8 8h2M8 12h2M8 16h2M17 13h.1M17 16h.1M3 20h18" /></svg>;
}

function groupStatus(group: AdminFacilityGroup) {
  const active = group.facilities.filter((unit) => unit.status === "ACTIVE").length;
  return {
    active,
    label: active ? "Aktif" : "Nonaktif",
    status: (active ? "ACTIVE" : "NONACTIVE") as FacilityUnitStatus,
  };
}

function modeLabel(group: AdminFacilityGroup) {
  return group.reservationMode === "EXCLUSIVE" ? "Ruang / area eksklusif" : "Alat bergerak";
}

export function AdminFacilities() {
  const { request } = useAuth();
  const [facilities, setFacilities] = useState<AdminFacilityGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      setFacilities(await request<AdminFacilityGroup[]>("/admin/facilities"));
    } catch (nextError) {
      setError(apiErrorMessage(nextError, "Fasilitas belum dapat dimuat. Coba lagi."));
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleFacilities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return facilities;
    return facilities.filter((facility) => `${facility.name} ${facility.facilityType.name} ${facility.facilityArea.name} ${facility.locationDetail} ${facility.facilities.map((unit) => unit.assetCode).join(" ")}`.toLocaleLowerCase("id-ID").includes(normalized));
  }, [facilities, query]);

  return (
    <main className="admin-page admin-facilities-page">
      <header className="admin-facility-page-header">
        <div>
          <h1>Fasilitas</h1>
        </div>
        <Link className="admin-primary-button" href="/admin/facilities/new"><span aria-hidden="true">+</span>Tambah Fasilitas</Link>
      </header>

      <section className="admin-facilities-surface" aria-label="Daftar fasilitas">
        <div className="admin-facilities-toolbar">
          <label className="admin-users-search">
            <SearchIcon />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, tipe, area, lokasi, atau kode aset..." type="search" value={query} />
          </label>
          <span className="admin-facilities-count">{visibleFacilities.length} fasilitas</span>
        </div>
        {error ? <p className="admin-master-error" role="alert">{error}</p> : null}
        <div className="admin-facilities-table-wrap">
          <table className="admin-facilities-table">
            <thead><tr><th>Fasilitas</th><th>Mode reservasi</th><th>Area & lokasi</th><th>Kapasitas</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td className="admin-facilities-empty" colSpan={6}>Memuat fasilitas…</td></tr> : null}
              {!isLoading && visibleFacilities.length === 0 ? <tr><td className="admin-facilities-empty" colSpan={6}>{query ? "Fasilitas tidak ditemukan." : "Belum ada fasilitas. Buat fasilitas pertama untuk memulai katalog."}</td></tr> : null}
              {!isLoading ? visibleFacilities.map((facility) => {
                const status = groupStatus(facility);
                const assetText = facility.reservationMode === "EXCLUSIVE" ? facility.facilities[0]?.assetCode ?? "—" : `${facility.facilities.length} unit aset`;
                return <tr key={facility.id}>
                  <td><div className="admin-facility-identity"><div className="admin-facility-thumb">{facility.primaryImageUrl ? <img alt="" src={facility.primaryImageUrl} /> : <FacilityPlaceholder />}</div><div><strong>{facility.name}</strong><small>{facility.facilityType.name} · {assetText}</small></div></div></td>
                  <td><span className={`admin-mode-pill admin-mode-pill--${facility.reservationMode.toLowerCase()}`}>{modeLabel(facility)}</span></td>
                  <td><div className="admin-facility-location"><strong>{facility.facilityArea.name}</strong><span>{facility.locationDetail}</span></div></td>
                  <td>{facility.capacity === null ? "—" : `${facility.capacity} orang`}</td>
                  <td><span className={`admin-status-pill admin-status-pill--${status.status.toLowerCase()}`}>{status.label}{facility.reservationMode === "QUANTITY" ? ` · ${status.active} unit` : ""}</span></td>
                  <td><Link aria-label={`Ubah ${facility.name}`} className="admin-icon-button" href={`/admin/facilities/${facility.id}`}><EditIcon /></Link></td>
                </tr>;
              }) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
