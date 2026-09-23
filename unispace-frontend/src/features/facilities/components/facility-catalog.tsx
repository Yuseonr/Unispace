"use client";

import { useMemo, useState } from "react";

import { facilityTypes, type CatalogFacility, type FacilityType } from "../types";
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
  if (filters.length === 0) {
    return true;
  }

  if (capacity === null) {
    return false;
  }

  return filters.some((filter) => {
    if (filter === "small") {
      return capacity <= 20;
    }

    if (filter === "medium") {
      return capacity >= 21 && capacity <= 50;
    }

    return capacity > 50;
  });
}

export function FacilityCatalog({ facilities }: { facilities: CatalogFacility[] }) {
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<FacilityType[]>([]);
  const [selectedAreaCodes, setSelectedAreaCodes] = useState<string[]>([]);
  const [selectedCapacities, setSelectedCapacities] = useState<CapacityFilter[]>([]);

  const facilityAreas = useMemo(
    () =>
      Array.from(
        new Map(
          facilities.map((facility) => [facility.facilityArea.code, facility.facilityArea]),
        ).values(),
      ).sort((first, second) => first.name.localeCompare(second.name, "id-ID")),
    [facilities],
  );

  const visibleFacilities = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");

    return facilities.filter((facility) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${facility.name} ${facility.type} ${facility.facilityArea.name} ${facility.locationDetail}`
          .toLocaleLowerCase("id-ID")
          .includes(normalizedQuery);

      return (
        matchesQuery &&
        (selectedTypes.length === 0 || selectedTypes.includes(facility.type)) &&
        (selectedAreaCodes.length === 0 ||
          selectedAreaCodes.includes(facility.facilityArea.code)) &&
        matchesCapacity(facility.capacity, selectedCapacities)
      );
    });
  }, [facilities, query, selectedAreaCodes, selectedCapacities, selectedTypes]);

  const hasActiveFilter =
    query.length > 0 ||
    selectedTypes.length > 0 ||
    selectedAreaCodes.length > 0 ||
    selectedCapacities.length > 0;

  function resetFilters() {
    setQuery("");
    setSelectedTypes([]);
    setSelectedAreaCodes([]);
    setSelectedCapacities([]);
  }

  return (
    <main className="landing catalog-page">
      <section className="catalog-directory" aria-labelledby="catalog-title">
        <form
          className="catalog-search"
          onSubmit={(event) => event.preventDefault()}
          role="search"
          aria-labelledby="catalog-title"
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
          <aside className="catalog-sidebar" aria-label="Filter katalog">
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
                <label key={facilityType}>
                  <input
                    checked={selectedTypes.includes(facilityType)}
                    onChange={() =>
                      setSelectedTypes((current) => toggleValue(current, facilityType))
                    }
                    type="checkbox"
                  />
                  {facilityType}
                </label>
              ))}
            </fieldset>

            <fieldset className="filter-group">
              <legend>Fakultas / area kampus</legend>
              <label>
                <input
                  checked={selectedAreaCodes.length === 0}
                  onChange={() => setSelectedAreaCodes([])}
                  type="checkbox"
                />
                Semua area
              </label>
              {facilityAreas.map((area) => (
                <label key={area.code}>
                  <input
                    checked={selectedAreaCodes.includes(area.code)}
                    onChange={() =>
                      setSelectedAreaCodes((current) => toggleValue(current, area.code))
                    }
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
                    onChange={() =>
                      setSelectedCapacities((current) => toggleValue(current, option.value))
                    }
                    type="checkbox"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          </aside>

          <section className="catalog-results" aria-labelledby="catalog-list-title">
            <div className="catalog-results__meta" aria-live="polite">
              <div>
                <h2 id="catalog-list-title">{visibleFacilities.length} fasilitas ditemukan</h2>
              </div>
            </div>

            <div className="facility-grid">
              {visibleFacilities.length > 0 ? (
                visibleFacilities.map((facility) => (
                  <FacilityCard facility={facility} key={facility.id} />
                ))
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
