"use client";
/* eslint-disable react-hooks/set-state-in-effect -- catalog request state follows URL filters and an async API response. */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ErrorState, LoadingState, Pagination } from "@/components/ui/page-primitives";

import { fetchPublicCatalog, type CatalogFilterOption } from "../data/catalog-api";
import type { CatalogFacility } from "../types";
import { FacilityCard } from "./facility-card";
import { SiteFooter } from "./site-footer";

const capacityOptions = [
  { label: "Semua kapasitas", value: "" },
  { label: "Minimal 20 orang", value: "20" },
  { label: "Minimal 50 orang", value: "50" },
  { label: "Minimal 100 orang", value: "100" },
];

function SearchIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>;
}

export function FacilityCatalog() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [facilities, setFacilities] = useState<CatalogFacility[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<CatalogFilterOption[]>([]);
  const [facilityAreas, setFacilityAreas] = useState<CatalogFilterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });

  const search = searchParams.get("search") ?? "";
  const facilityTypeId = searchParams.get("facilityTypeId") ?? "";
  const facilityAreaId = searchParams.get("facilityAreaId") ?? "";
  const minCapacity = searchParams.get("minCapacity") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => setSearchDraft(search), [search]);

  const query = useMemo(() => ({
    facilityAreaId: facilityAreaId || undefined,
    facilityTypeId: facilityTypeId || undefined,
    minCapacity: minCapacity ? Number(minCapacity) : undefined,
    page,
    search: search || undefined,
  }), [facilityAreaId, facilityTypeId, minCapacity, page, search]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchPublicCatalog(query)
      .then((catalog) => {
        if (!active) return;
        setFacilities(catalog.facilities);
        setFacilityTypes(catalog.types);
        setFacilityAreas(catalog.areas);
        setMeta({ page: catalog.page, total: catalog.total, totalPages: catalog.totalPages });
        setError(null);
      })
      .catch(() => { if (active) setError("Katalog fasilitas belum dapat dimuat. Coba lagi beberapa saat."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchDraft.trim() !== search) updateQuery({ page: "", search: searchDraft.trim() });
    }, 300);
    return () => window.clearTimeout(timeout);
  // search is intentionally derived from URL to debounce only user input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  function updateQuery(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (!value) next.delete(key); else next.set(key, value);
    });
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  function setFilter(key: "facilityTypeId" | "facilityAreaId" | "minCapacity", value: string) {
    updateQuery({ [key]: value, page: "" });
    setIsFilterOpen(false);
  }

  function resetFilters() {
    setSearchDraft("");
    router.replace(pathname, { scroll: false });
    setIsFilterOpen(false);
  }

  const activeChips = [
    search ? { label: `Pencarian: ${search}`, key: "search" } : null,
    facilityTypes.find((item) => item.id === facilityTypeId) ? { label: facilityTypes.find((item) => item.id === facilityTypeId)!.name, key: "facilityTypeId" } : null,
    facilityAreas.find((item) => item.id === facilityAreaId) ? { label: facilityAreas.find((item) => item.id === facilityAreaId)!.name, key: "facilityAreaId" } : null,
    minCapacity ? { label: `≥ ${minCapacity} orang`, key: "minCapacity" } : null,
  ].filter((item): item is { key: string; label: string } => Boolean(item));

  const filters = <>
    <div className="catalog-sidebar__heading"><h2>Filter pencarian</h2>{activeChips.length ? <button onClick={resetFilters} type="button">Hapus semua</button> : null}</div>
    <fieldset className="filter-group"><legend>Tipe fasilitas</legend><label><input checked={!facilityTypeId} onChange={() => setFilter("facilityTypeId", "")} type="radio" name="type" />Semua tipe</label>{facilityTypes.map((type) => <label key={type.id}><input checked={facilityTypeId === type.id} name="type" onChange={() => setFilter("facilityTypeId", type.id)} type="radio" />{type.name}</label>)}</fieldset>
    <fieldset className="filter-group"><legend>Fakultas / area kampus</legend><label><input checked={!facilityAreaId} name="area" onChange={() => setFilter("facilityAreaId", "")} type="radio" />Semua area</label>{facilityAreas.map((area) => <label key={area.id}><input checked={facilityAreaId === area.id} name="area" onChange={() => setFilter("facilityAreaId", area.id)} type="radio" />{area.name}</label>)}</fieldset>
    <fieldset className="filter-group"><legend>Kapasitas</legend>{capacityOptions.map((option) => <label key={option.label}><input checked={minCapacity === option.value} name="capacity" onChange={() => setFilter("minCapacity", option.value)} type="radio" />{option.label}</label>)}</fieldset>
  </>;

  return <main className="landing catalog-page"><section aria-labelledby="catalog-title" className="catalog-directory">
    <form aria-labelledby="catalog-title" className="catalog-search" onSubmit={(event) => event.preventDefault()} role="search"><h1 className="sr-only" id="catalog-title">Katalog fasilitas</h1><label htmlFor="facility-search">Cari fasilitas</label><div className="catalog-search__field"><SearchIcon /><input id="facility-search" onChange={(event) => setSearchDraft(event.target.value)} placeholder="Cari nama ruang, lokasi, atau jenis fasilitas" type="search" value={searchDraft} /></div></form>
    <button aria-expanded={isFilterOpen} className="catalog-mobile-filter" onClick={() => setIsFilterOpen((open) => !open)} type="button">Filter{activeChips.length ? ` (${activeChips.length})` : ""}</button>
    <div className="catalog-layout"><aside aria-label="Filter katalog" className={`catalog-sidebar${isFilterOpen ? " is-open" : ""}`}>{filters}</aside><section aria-labelledby="catalog-list-title" className="catalog-results"><div aria-live="polite" className="catalog-results__meta"><div><h2 id="catalog-list-title">{isLoading ? "Memperbarui katalog…" : `${meta.total} fasilitas ditemukan`}</h2></div></div>{activeChips.length ? <div className="catalog-active-chips">{activeChips.map((chip) => <button key={chip.key} onClick={() => updateQuery({ [chip.key]: "", page: "" })} type="button">{chip.label}<span aria-hidden="true">×</span></button>)}</div> : null}<div className="facility-grid">{isLoading && !facilities.length ? <LoadingState label="Memuat fasilitas terbaru…" /> : error ? <ErrorState error={error} onRetry={() => updateQuery({ page: String(page) })} /> : facilities.length ? facilities.map((facility) => <FacilityCard facility={facility} key={facility.id} />) : <div className="empty-state"><strong>Belum menemukan fasilitas.</strong><span>Coba kata kunci atau filter yang berbeda.</span><button onClick={resetFilters} type="button">Reset pilihan</button></div>}</div>{!isLoading && !error ? <Pagination onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })} page={meta.page} total={meta.total} totalPages={meta.totalPages} /> : null}</section></div>
  </section><SiteFooter /></main>;
}
