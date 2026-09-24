"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchPublicCatalog, type CatalogFilterOption } from "../data/catalog-api";
import type { CatalogFacility } from "../types";
import { FacilityCard } from "./facility-card";
import { SiteFooter } from "./site-footer";

type CapacityFilter = "medium" | "large" | "small";

const capacityOptions: Array<{ label: string; value: CapacityFilter }> = [
  { label: "Hingga 20 orang", value: "small" },
  { label: "21–50 orang", value: "medium" },
  { label: "Lebih dari 50 orang", value: "large" },
];

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function toggleValue<Value>(values: Value[], value: Value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function matchesCapacity(capacity: number | null, filters: CapacityFilter[]) {
  if (filters.length === 0) return true;
  if (capacity === null) return false;

  return filters.some((filter) => {
    if (filter === "small") return capacity <= 20;
    if (filter === "medium") return capacity >= 21 && capacity <= 50;
    return capacity > 50;
  });
}

function matchesType(facility: CatalogFacility, selectedTypes: string[]) {
  if (selectedTypes.length === 0) return true;
  return selectedTypes.includes(facility.facilityTypeId ?? facility.type);
}

function matchesArea(facility: CatalogFacility, selectedAreas: string[]) {
  if (selectedAreas.length === 0) return true;
  return selectedAreas.includes(facility.facilityArea.id ?? facility.facilityArea.code);
}

export function FacilityCatalog() {
  const [facilities, setFacilities] = useState<CatalogFacility[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<CatalogFilterOption[]>([]);
  const [facilityAreas, setFacilityAreas] = useState<CatalogFilterOption[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedCapacities, setSelectedCapacities] = useState<CapacityFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchPublicCatalog()
      .then((catalog) => {
        if (!isMounted) return;
        setFacilities(catalog.facilities);
        setFacilityTypes(catalog.types);
        setFacilityAreas(catalog.areas);
      })
      .catch(() => {
        if (isMounted) setError("Katalog fasilitas belum dapat dimuat. Coba lagi beberapa saat.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleFacilities = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");

    return facilities.filter((facility) => {
      const searchableText = `${facility.name} ${facility.type} ${facility.facilityArea.name} ${facility.locationDetail} ${facility.description ?? ""}`
        .toLocaleLowerCase("id-ID");
      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return (
        matchesQuery &&
        matchesType(facility, selectedTypes) &&
        matchesArea(facility, selectedAreas) &&
        matchesCapacity(facility.capacity, selectedCapacities)
      );
    });
  }, [facilities, query, selectedAreas, selectedCapacities, selectedTypes]);

  const hasActiveFilter =
    query.length > 0 || selectedTypes.length > 0 || selectedAreas.length > 0 || selectedCapacities.length > 0;

  function resetFilters() {
    setQuery("");
    setSelectedTypes([]);
    setSelectedAreas([]);
    setSelectedCapacities([]);
  }

  return (
    <main className="landing catalog-page">
      <section className="catalog-directory" aria-labelledby="catalog-title">
        <form
          aria-labelledby="catalog-title"
          className="catalog-search"
          onSubmit={(event) => event.preventDefault()}
          role="search"
        >
          <h1 className="sr-only" id="catalog-title">
            Katalog fasilitas
          </h1>
          <label htmlFor="facility-search">Cari fasilitas</label>
          <div className="catalog-search__field">
            <SearchIcon />
            <input
              id="facility-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama ruang, fakultas, lokasi detail, atau jenis fasilitas"
              type="search"
              value={query}
            />
          </div>
        </form>

        <div className="catalog-layout">
          <aside aria-label="Filter katalog" className="catalog-sidebar">
            <div className="catalog-sidebar__heading">
              <h2>Filter pencarian</h2>
              {hasActiveFilter ? (
                <button onClick={resetFilters} type="button">
                  Hapus semua
                </button>
              ) : null}
            </div>

            <fieldset className="filter-group">
              <legend>Tipe fasilitas</legend>
              <label>
                <input
                  checked={selectedTypes.length === 0}
                  onChange={() => setSelectedTypes([])}
                  type="checkbox"
                />
                Semua tipe
              </label>
              {facilityTypes.map((facilityType) => (
                <label key={facilityType.id}>
                  <input
                    checked={selectedTypes.includes(facilityType.id)}
                    onChange={() => setSelectedTypes((current) => toggleValue(current, facilityType.id))}
                    type="checkbox"
                  />
                  {facilityType.name}
                </label>
              ))}
            </fieldset>

            <fieldset className="filter-group">
              <legend>Fakultas / area kampus</legend>
              <label>
                <input
                  checked={selectedAreas.length === 0}
                  onChange={() => setSelectedAreas([])}
                  type="checkbox"
                />
                Semua area
              </label>
              {facilityAreas.map((area) => (
                <label key={area.id}>
                  <input
                    checked={selectedAreas.includes(area.id)}
                    onChange={() => setSelectedAreas((current) => toggleValue(current, area.id))}
                    type="checkbox"
                  />
                  {area.name}
                </label>
              ))}
            </fieldset>

            <fieldset className="filter-group">
              <legend>Kapasitas</legend>
              <label>
                <input
                  checked={selectedCapacities.length === 0}
                  onChange={() => setSelectedCapacities([])}
                  type="checkbox"
                />
                Semua kapasitas
              </label>
              {capacityOptions.map((option) => (
                <label key={option.value}>
                  <input
                    checked={selectedCapacities.includes(option.value)}
                    onChange={() => setSelectedCapacities((current) => toggleValue(current, option.value))}
                    type="checkbox"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          </aside>

          <section aria-labelledby="catalog-list-title" className="catalog-results">
            <div aria-live="polite" className="catalog-results__meta">
              <div>
                <h2 id="catalog-list-title">
                  {isLoading ? "Memuat katalog…" : `${visibleFacilities.length} fasilitas ditemukan`}
                </h2>
              </div>
            </div>

            <div className="facility-grid">
              {isLoading ? (
                <div className="empty-state">
                  <strong>Memuat fasilitas.</strong>
                  <span>Mengambil katalog terbaru dari Unispace.</span>
                </div>
              ) : error ? (
                <div className="empty-state">
                  <strong>Katalog belum tersedia.</strong>
                  <span>{error}</span>
                </div>
              ) : visibleFacilities.length > 0 ? (
                visibleFacilities.map((facility) => <FacilityCard facility={facility} key={facility.id} />)
              ) : (
                <div className="empty-state">
                  <strong>Belum menemukan fasilitas.</strong>
                  <span>Coba kata kunci atau filter yang berbeda.</span>
                  <button onClick={resetFilters} type="button">
                    Reset pilihan
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
