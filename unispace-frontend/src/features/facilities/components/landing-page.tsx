"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchFeaturedFacilities } from "../data/catalog-api";
import type { CatalogFacility } from "../types";
import { FacilityCard } from "./facility-card";
import { SiteFooter } from "./site-footer";

function DecorativeArt() {
  return <svg aria-hidden="true" className="landing-art" fill="none" preserveAspectRatio="none" viewBox="0 0 1400 2200">
    <circle cx="1210" cy="190" r="230" /><circle cx="1210" cy="190" r="170" /><circle cx="1210" cy="190" r="105" />
    <circle cx="-40" cy="250" r="90" /><circle cx="-40" cy="250" r="62" /><circle cx="-40" cy="250" r="34" />
    <rect x="86" y="785" width="104" height="104" /><rect x="116" y="815" width="104" height="104" />
    <circle cx="365" cy="850" r="126" /><circle cx="365" cy="850" r="82" /><rect x="325" y="810" width="80" height="80" />
    <path d="M1060 690a150 150 0 0 1 300 0" /><path d="M1105 690a105 105 0 0 1 210 0" />
    <g transform="rotate(-8 -70 430)"><polygon points="-190,540 -40,390 50,540" /><polygon points="-136,514 -35,432 18,514" /></g>
    <path d="M940 1030a220 220 0 0 0 440 0" /><path d="M1110 1440a170 170 0 0 1 340 0" />
    <circle cx="1180" cy="1770" r="100" /><circle cx="1180" cy="1770" r="58" /><circle cx="1180" cy="1770" r="24" /><path d="M-80 1760a330 330 0 0 1 660 0" />
  </svg>;
}

export function LandingPage() {
  const [facilities, setFacilities] = useState<CatalogFacility[]>([]);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFeaturedFacilities()
      .then((items) => { if (active) setFacilities(items); })
      .catch(() => { if (active) setError("Preview fasilitas belum dapat dimuat. Katalog lengkap tetap dapat dibuka."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const activeSlide = facilities.length > 0 ? selectedSlide % facilities.length : 0;

  function showPreviousSlide() {
    setSelectedSlide((current) =>
      facilities.length > 0 ? (current - 1 + facilities.length) % facilities.length : 0,
    );
  }

  function showNextSlide() {
    setSelectedSlide((current) =>
      facilities.length > 0 ? (current + 1) % facilities.length : 0,
    );
  }

  return <main className="landing">
    <DecorativeArt />
    <section aria-labelledby="hero-title" className="hero">
      <div className="hero-shell">
        <div className="hero__copy"><div className="hero__content-zone">
          <h1 id="hero-title"><Image alt="Unispace" className="hero-title-logo" height={360} src="/Unispace_Logo_Trademark.svg" width={1450} /></h1>
          <p className="hero__description">Tempat reservasi dan pelaporan fasilitas kampus.</p>
          <div className="hero__actions"><Link className="button-primary" href="/facilities">Jelajahi fasilitas</Link><a className="button-secondary" href="#cara-kerja">Kenali Unispace</a></div>
        </div></div>
        <div aria-label="Fasilitas pilihan" aria-roledescription="carousel" className="hero__showcase" role="region">
          <div className="hero__visual">
            <div className="hero__carousel-viewport">
              <div className="hero__carousel-track" id="featured-facilities-track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
                {facilities.length > 0 ? facilities.map((facility, index) => (
                  <Link
                    aria-hidden={index !== activeSlide}
                    aria-label={`Lihat detail ${facility.name}, ${facility.facilityArea.name}`}
                    className="hero__carousel-slide"
                    href={`/facilities/${facility.id}`}
                    key={facility.id}
                    tabIndex={index === activeSlide ? 0 : -1}
                  >
                    <div className="hero__visual-card">
                      {facility.primaryImageUrl ? <Image alt="" className="hero__photo" fill preload={index === activeSlide} sizes="(max-width: 820px) 100vw, 52vw" src={facility.primaryImageUrl} unoptimized /> : <div aria-hidden="true" className="hero__photo hero__photo--placeholder" />}
                      <div aria-hidden="true" className="hero__photo-overlay" />
                      <div className="hero__visual-label"><small>Fasilitas pilihan</small><strong>{facility.name}</strong><span>{facility.facilityArea.name}, {facility.locationDetail}</span></div>
                    </div>
                  </Link>
                )) : (
                  <div aria-label="Preview katalog fasilitas" className="hero__visual-card" role="img">
                    <div aria-hidden="true" className="hero__photo hero__photo--placeholder" />
                    <div aria-hidden="true" className="hero__photo-overlay" />
                    <div className="hero__visual-label"><small>{isLoading ? "Memuat katalog" : "Katalog fasilitas"}</small><strong>Temukan fasilitas kampus</strong><span>Jelajahi katalog untuk melihat fasilitas terbaru.</span></div>
                  </div>
                )}
              </div>
              {facilities.length > 1 ? (
                <>
                  <button aria-controls="featured-facilities-track" aria-label="Fasilitas sebelumnya" className="hero__carousel-arrow hero__carousel-arrow--previous" onClick={showPreviousSlide} type="button"><span aria-hidden="true">←</span></button>
                  <button aria-controls="featured-facilities-track" aria-label="Fasilitas berikutnya" className="hero__carousel-arrow hero__carousel-arrow--next" onClick={showNextSlide} type="button"><span aria-hidden="true">→</span></button>
                </>
              ) : null}
            </div>
            {facilities.length > 1 ? (
              <div className="hero__carousel-pagination">
                <div aria-label="Pilih slide fasilitas" className="hero__carousel-dots">
                  {facilities.map((facility, index) => (
                    <button aria-label={`Tampilkan ${facility.name}`} aria-pressed={index === activeSlide} className="hero__carousel-dot" key={facility.id} onClick={() => setSelectedSlide(index)} type="button" />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
    <section aria-label="Cara kerja Unispace" className="how-section" id="cara-kerja"><div className="workflow-grid">
      <article className="workflow-card"><div className="workflow-card__meta"><span className="workflow-card__number">01</span><span className="workflow-card__label">Reservasi</span></div><h2>Temukan ruang untuk kegiatanmu.</h2><p>Pilih fasilitas yang sesuai, cek ketersediaannya, lalu ajukan reservasi dengan langkah yang sederhana.</p><ol className="workflow-card__list"><li>Jelajahi katalog fasilitas.</li><li>Bandingkan ruang berdasarkan kebutuhanmu.</li><li>Ajukan reservasi untuk jadwal kegiatan.</li></ol></article>
      <article className="workflow-card"><div className="workflow-card__meta"><span className="workflow-card__number">02</span><span className="workflow-card__label">Pelaporan</span></div><h2>Bantu jaga fasilitas tetap siap.</h2><p>Sampaikan kerusakan atau kendala fasilitas agar dapat segera ditindaklanjuti oleh pihak kampus.</p><ol className="workflow-card__list"><li>Pilih fasilitas yang ingin dilaporkan.</li><li>Jelaskan kondisi atau kendalanya.</li><li>Kirim laporan untuk ditindaklanjuti.</li></ol></article>
    </div></section>
    <section aria-label="Fasilitas pilihan" className="landing-section facilities-preview" id="fasilitas"><div className="facilities-preview__heading"><Link className="text-link" href="/facilities">Buka katalog lengkap</Link></div><div className="facility-grid">{isLoading ? Array.from({ length: 3 }, (_, index) => <div aria-label="Memuat fasilitas" className="landing-facility-skeleton" key={index} role="status" />) : facilities.map((facility) => <FacilityCard facility={facility} key={facility.id} />)}</div>{error ? <p className="landing-preview-error" role="status">{error}</p> : null}</section>
    <SiteFooter />
  </main>;
}
