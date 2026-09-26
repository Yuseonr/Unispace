"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { CatalogFacility } from "../types";

function FacilityArtwork({ type }: { type: string }) {
  if (type === "Lapangan") {
    return (
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect x="12" y="20" width="76" height="60" rx="4" stroke="currentColor" strokeWidth="4" />
        <path d="M50 20v60M12 50h76M31 20c8 9 8 51 0 60M69 20c-8 9-8 51 0 60" stroke="currentColor" strokeWidth="3" />
        <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="3" />
      </svg>
    );
  }

  if (type === "Peralatan") {
    return (
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path d="M28 31h44a7 7 0 0 1 7 7v27a7 7 0 0 1-7 7H28a7 7 0 0 1-7-7V38a7 7 0 0 1 7-7Z" stroke="currentColor" strokeWidth="4" />
        <circle cx="50" cy="51" r="12" stroke="currentColor" strokeWidth="4" />
        <path d="M50 72v11M38 84h24" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
      </svg>
    );
  }

  if (type === "Laboratorium") {
    return (
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path d="M42 18v25L23 75a7 7 0 0 0 6 10h42a7 7 0 0 0 6-10L58 43V18" stroke="currentColor" strokeLinejoin="round" strokeWidth="4" />
        <path d="M33 62h34M38 18h24" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        <path d="M38 75c7-10 17-8 24 0" stroke="currentColor" strokeWidth="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M16 81V42L50 18l34 24v39H16Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="4" />
      <path d="M37 81V58h26v23M31 46h8M61 46h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
    </svg>
  );
}

export function FacilityVisual({ facility }: { facility: CatalogFacility }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (facility.primaryImageUrl && !imageFailed) {
    return (
      <Image
        alt={`Foto ${facility.name}`}
        className="facility-visual__image"
        fill
        loading="lazy"
        onError={() => setImageFailed(true)}
        src={facility.primaryImageUrl}
        sizes="(max-width: 560px) 100vw, (max-width: 820px) 50vw, 33vw"
        unoptimized
      />
    );
  }

  return <FacilityArtwork type={facility.type} />;
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function AreaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h16M6 20V8l6-4 6 4v12M9 20v-5h6v5M9 10h.01M12 10h.01M15 10h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CapacityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M17 9.5a2.5 2.5 0 1 0 0-5M18 14a4 4 0 0 1 3 3.87V20" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function FacilityCard({ facility }: { facility: CatalogFacility }) {
  const isMaintenance = facility.status === "MAINTENANCE";
  const unitText =
    facility.availability.kind === "QUANTITY"
      ? "activeUnits" in facility.availability
        ? `${facility.availability.activeUnits ?? 0} unit aktif`
        : `${facility.availability.availableUnits ?? 0}/${facility.availability.totalActiveUnits ?? 0} unit`
      : null;
  const capacityText =
    facility.capacity === null ? "Kapasitas fleksibel" : `${facility.capacity} orang`;
  const statusClassName = `facility-status ${
    isMaintenance ? "facility-status--maintenance" : "facility-status--active"
  }`;

  return (
    <Link className="facility-card" href={`/facilities/${facility.id}`}>
      <div
        aria-label={`Ilustrasi ${facility.type}`}
        className="facility-visual"
        data-theme={facility.visualTheme}
        role="img"
      >
        <FacilityVisual facility={facility} />
      </div>
      <div className="facility-card__body">
        <div className="facility-card__topline">
          <span className="facility-type">{facility.type}</span>
          <span className={statusClassName}>
            {isMaintenance ? "Dalam perbaikan" : "Tersedia"}
          </span>
        </div>

        <h3>{facility.name}</h3>

        <div className="facility-details">
          <div>
            <AreaIcon />
            <span>{facility.facilityArea.name}</span>
          </div>
          <div>
            <PinIcon />
            <span>{facility.locationDetail}</span>
          </div>
          <div>
            <CapacityIcon />
            <span>{capacityText}</span>
          </div>
        </div>

        <div className="facility-card__footer">
          {unitText ? (
            <span className="facility-card__unit-info">{unitText}</span>
          ) : null}
          <span className="facility-card__action">
            Lihat Jadwal
          </span>
        </div>
      </div>
    </Link>
  );
}
