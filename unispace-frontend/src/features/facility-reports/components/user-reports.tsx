"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import {
  type FacilityReport,
  type ReportCategory,
  type ReportableFacility,
  REPORT_CATEGORIES,
  getMyReport,
  listMyReports,
  listReportableFacilities,
} from "../api";
import { AttachmentPreview } from "./attachment-preview";

export function UserReports({ createMode = false }: { createMode?: boolean }) {
  const router = useRouter();
  const { isReady, request, user } = useAuth();
  const [reports, setReports] = useState<FacilityReport[]>([]);
  const [reportables, setReportables] = useState<ReportableFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<ReportableFacility | null>(null);
  const [selectedReport, setSelectedReport] = useState<FacilityReport | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ReportCategory>("PHYSICAL_DAMAGE");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && user?.role !== "USER") router.replace("/login");
  }, [isReady, router, user?.role]);

  useEffect(() => {
    if (!isReady || user?.role !== "USER") return;
    listMyReports(request).then((result) => setReports(result.items)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Gagal memuat laporan."));
  }, [isReady, request, user?.role]);

  useEffect(() => {
    if (!isReady || user?.role !== "USER" || !createMode) return;
    const timer = window.setTimeout(() => {
      listReportableFacilities(request, { limit: 20, search }).then((result) => setReportables(result.items)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Gagal mencari fasilitas."));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [createMode, isReady, request, search, user?.role]);

  async function openDetail(id: string) {
    setError(null);
    try {
      setSelectedReport(await getMyReport(request, id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal memuat detail laporan.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFacility) return setError("Pilih unit fasilitas yang dilaporkan.");
    if (photos.length < 1 || photos.length > 3) return setError("Unggah 1 sampai 3 foto bukti.");
    if (photos.some((photo) => photo.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) {
      return setError("Foto harus JPEG, PNG, atau WebP dan maksimal 5 MB.");
    }
    const form = new FormData();
    form.set("facilityId", selectedFacility.facilityId);
    form.set("category", category);
    form.set("description", description);
    photos.forEach((photo) => form.append("photos", photo));
    setBusy(true);
    setError(null);
    try {
      const report = await request<FacilityReport>("/reports", { body: form, method: "POST" });
      setNotice(`Laporan ${report.reportNumber} berhasil dikirim.`);
      router.replace("/reports");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Laporan tidak dapat dikirim.");
    } finally {
      setBusy(false);
    }
  }

  if (!isReady || user?.role !== "USER") return <main className="user-res-page">Memuat laporan…</main>;

  if (createMode) {
    return <main className="user-res-page"><Link href="/reports">← Kembali ke laporan saya</Link><h1 className="user-res-title">Laporkan Kendala Fasilitas</h1><p className="user-res-subtitle">Pilih unit fisik yang bermasalah dan unggah bukti foto.</p>
      <form className="reservation-form" onSubmit={submit} style={{ maxWidth: 780 }}>
        <label> Cari unit atau kode aset <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Contoh: PRJ-001 atau Ruang 101" /></label>
        <div aria-label="Hasil fasilitas yang dapat dilaporkan" style={{ display: "grid", gap: 8, marginBlock: 12 }}>
          {reportables.map((facility) => <button aria-pressed={selectedFacility?.facilityId === facility.facilityId} className="facility-option" key={facility.facilityId} onClick={() => setSelectedFacility(facility)} type="button"><strong>{facility.assetCode} · {facility.name}</strong><span>{facility.facilityGroup.name} · {facility.facilityArea.name} · {facility.status === "MAINTENANCE" ? "Dalam perbaikan" : "Aktif"}</span></button>)}
        </div>
        <label>Kategori<select value={category} onChange={(event) => setCategory(event.target.value as ReportCategory)}>{REPORT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Jelaskan kendala<textarea maxLength={5000} onChange={(event) => setDescription(event.target.value)} required value={description} /></label>
        <label>Foto bukti (1–3 file, maksimal 5 MB/file)<input accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setPhotos(Array.from(event.target.files ?? []))} required type="file" /></label>
        {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
        <button className="button-primary" disabled={busy} type="submit">{busy ? "Mengirim…" : "Kirim laporan"}</button>
      </form>
    </main>;
  }

  return <main className="user-res-page"><div className="user-res-header"><div><h1 className="user-res-title">Laporan Saya</h1><p className="user-res-subtitle">Pantau tindak lanjut laporan fasilitas dan bukti foto Anda.</p></div><Link className="button-primary" href="/reports/new">+ Buat laporan</Link></div>
    {notice ? <p role="status">{notice}</p> : null}{error ? <p role="alert">{error}</p> : null}
    <div style={{ display: "grid", gap: 12 }}>{reports.length ? reports.map((report) => <button className="user-res-card" key={report.id} onClick={() => void openDetail(report.id)} type="button"><strong>{report.reportNumber} · {report.facility.assetCode}</strong><span>{report.categoryLabel} · {report.statusLabel}</span><small>{new Date(report.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</small></button>) : <p>Belum ada laporan fasilitas.</p>}</div>
    {selectedReport ? <section aria-label="Detail laporan" className="reservation-modal__dialog" style={{ marginTop: 20 }}><button onClick={() => setSelectedReport(null)} type="button">Tutup</button><h2>{selectedReport.reportNumber}</h2><p>{selectedReport.description}</p><p>Status: <strong>{selectedReport.statusLabel}</strong></p>{selectedReport.decisionReason ? <p>Alasan keputusan: {selectedReport.decisionReason}</p> : null}{selectedReport.resolutionNote ? <p>Catatan penyelesaian: {selectedReport.resolutionNote}</p> : null}<div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{selectedReport.attachments.map((attachment) => <AttachmentPreview attachment={attachment} key={attachment.id} />)}</div></section> : null}
  </main>;
}
