"use client";
/* eslint-disable @next/next/no-img-element -- previews are local object URLs before upload. */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingState, PageHeader } from "@/components/ui/page-primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { readableApiError } from "@/lib/api/error-message";

import {
  REPORT_CATEGORIES,
  type ReportCategory,
  type ReportableFacility,
  createReport,
  listReportableFacilities,
} from "../api";

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function CreateReportPage() {
  const router = useRouter();
  const { isReady, request, user } = useAuth();
  const idempotencyKey = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState<ReportableFacility[]>([]);
  const [facilityPage, setFacilityPage] = useState(1);
  const [facilityMeta, setFacilityMeta] = useState({ total: 0, totalPages: 1 });
  const [selectedFacility, setSelectedFacility] = useState<ReportableFacility | null>(null);
  const [category, setCategory] = useState<ReportCategory>("PHYSICAL_DAMAGE");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isReady || user?.role !== "USER") return;
    const timeout = window.setTimeout(() => {
      const query = search.trim();
      if (!query) {
        setFacilities([]);
        setFacilityPage(1);
        setFacilityMeta({ total: 0, totalPages: 1 });
        setLoadingFacilities(false);
        return;
      }
      setLoadingFacilities(true);
      listReportableFacilities(request, { limit: 12, page: 1, search: query })
        .then((result) => {
          setFacilities(result.items);
          setFacilityPage(result.page);
          setFacilityMeta({ total: result.total, totalPages: result.totalPages });
        })
        .catch((reason) => setError(readableApiError(reason, "Fasilitas belum dapat dicari.")))
        .finally(() => setLoadingFacilities(false));
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [isReady, request, search, user?.role]);

  async function loadMore() {
    const nextPage = facilityPage + 1;
    setLoadingFacilities(true);
    try {
      const result = await listReportableFacilities(request, { limit: 12, page: nextPage, search: search.trim() || undefined });
      setFacilities((current) => [...current, ...result.items]);
      setFacilityPage(result.page);
      setFacilityMeta({ total: result.total, totalPages: result.totalPages });
    } catch (reason) {
      setError(readableApiError(reason, "Fasilitas belum dapat dimuat."));
    } finally {
      setLoadingFacilities(false);
    }
  }

  function addPhotos(files: File[]) {
    const invalid = files.find((file) => !SUPPORTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_BYTES);
    if (invalid) {
      setError("Setiap foto harus JPEG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
      return;
    }
    const next = [...photos, ...files];
    if (next.length > 3) {
      setError("Anda hanya dapat mengunggah maksimal tiga foto.");
      return;
    }
    setError(null);
    setPhotos(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!selectedFacility) return setError("Pilih unit fasilitas yang dilaporkan.");
    if (!description.trim()) return setError("Deskripsi kendala wajib diisi.");
    if (photos.length < 1 || photos.length > 3) return setError("Unggah 1–3 foto bukti.");
    const form = new FormData();
    form.set("facilityId", selectedFacility.facilityId);
    form.set("category", category);
    form.set("description", description.trim());
    photos.forEach((photo) => form.append("photos", photo));
    idempotencyKey.current ??= crypto.randomUUID();
    setBusy(true);
    try {
      await createReport(request, form, idempotencyKey.current);
      idempotencyKey.current = null;
      router.replace("/reports?created=1");
    } catch (reason) {
      setError(readableApiError(reason, "Laporan belum dapat dikirim."));
    } finally {
      setBusy(false);
    }
  }

  if (!isReady || user?.role !== "USER") {
    return <main className="user-res-page"><LoadingState label="Memeriksa akses laporan…" /></main>;
  }

  return <main className="user-res-page">
    <PageHeader eyebrow="Pelaporan fasilitas" title="Laporkan Kendala"><Link href="/reports">← Kembali ke laporan saya</Link></PageHeader>
    <form className="report-create-form" onSubmit={submit}>
      <section>
        <h2>1. Pilih unit fasilitas</h2>
        <div className="report-facility-picker" ref={dropdownRef}>
          <label className="ui-form-field">
            <span>Ketik nama unit atau kode aset fasilitas</span>
            <input
              autoComplete="off"
              onChange={(event) => {
                setSearch(event.target.value);
                setShowSuggestions(true);
                if (selectedFacility) {
                  setSelectedFacility(null);
                }
              }}
              onFocus={() => {
                if (search.trim().length > 0) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="Contoh: PRJ-001 atau Laboratorium Jaringan"
              ref={inputRef}
              type="search"
              value={search}
            />
          </label>

          {showSuggestions && search.trim().length > 0 ? (
            <div aria-label="Hasil fasilitas yang dapat dilaporkan" className="report-facility-suggestions">
              {loadingFacilities ? (
                <div style={{ padding: "0.85rem", textAlign: "center" }}>
                  <LoadingState compact label="Mencari unit fasilitas…" />
                </div>
              ) : facilities.length ? (
                <div className="report-facility-suggestions__list">
                  {facilities.map((facility) => (
                    <button
                      className="report-facility-suggestion-item"
                      key={facility.facilityId}
                      onClick={() => {
                        setSelectedFacility(facility);
                        setSearch(`${facility.assetCode} · ${facility.name}`);
                        setShowSuggestions(false);
                      }}
                      type="button"
                    >
                      <strong>{facility.assetCode} · {facility.name}</strong>
                      <small>{facility.facilityGroup.name} · {facility.facilityArea.name} · {facility.locationDetail}</small>
                    </button>
                  ))}
                  {facilityPage < facilityMeta.totalPages ? (
                    <button
                      className="report-facility-suggestions__more"
                      disabled={loadingFacilities}
                      onClick={(e) => {
                        e.stopPropagation();
                        void loadMore();
                      }}
                      type="button"
                    >
                      {loadingFacilities ? "Memuat…" : "Muat lebih banyak"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div style={{ color: "#6b8577", fontSize: "0.76rem", padding: "0.85rem", textAlign: "center" }}>
                  Tidak ada unit fasilitas yang cocok dengan &quot;{search}&quot;.
                </div>
              )}
            </div>
          ) : null}

          {selectedFacility ? (
            <div className="report-selected-facility">
              <div className="report-selected-facility__info">
                <span className="report-selected-facility__badge">Unit Terpilih</span>
                <strong>{selectedFacility.assetCode} · {selectedFacility.name}</strong>
                <small>{selectedFacility.facilityGroup.name} · {selectedFacility.facilityArea.name} · {selectedFacility.locationDetail}</small>
              </div>
              <button
                className="report-selected-facility__remove"
                onClick={() => {
                  setSelectedFacility(null);
                  setSearch("");
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                type="button"
              >
                Ganti
              </button>
            </div>
          ) : null}
        </div>
      </section>
      <section><h2>2. Jelaskan kendala dan unggah bukti</h2><label className="ui-form-field"><span>Kategori</span><select onChange={(event) => setCategory(event.target.value as ReportCategory)} value={category}>{REPORT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="ui-form-field"><span>Deskripsi kendala</span><textarea maxLength={5000} onChange={(event) => setDescription(event.target.value)} required value={description} /></label><label className="report-upload"><span>Foto bukti · JPEG, PNG, WebP · 1–3 file · maksimum 5 MB/file</span><input accept="image/jpeg,image/png,image/webp" disabled={photos.length >= 3} multiple onChange={(event) => { addPhotos(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} type="file" /></label><div className="report-upload-preview">{previews.map(({ file, url }) => <figure key={`${file.name}-${file.lastModified}`}><img alt={`Preview ${file.name}`} src={url} /><button aria-label={`Hapus ${file.name}`} onClick={() => setPhotos((current) => current.filter((item) => item !== file))} type="button">×</button><figcaption>{file.name}</figcaption></figure>)}</div></section>
      {error ? <p className="ui-form-feedback ui-form-feedback--error" role="alert">{error}</p> : null}
      <footer><Link className="admin-secondary-button" href="/reports">Batal</Link><button className="admin-primary-button" disabled={busy} type="submit">{busy ? "Mengirim…" : "Kirim laporan"}</button></footer>
    </form>
  </main>;
}
