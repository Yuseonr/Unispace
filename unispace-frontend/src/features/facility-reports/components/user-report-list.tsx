"use client";
/* eslint-disable react-hooks/set-state-in-effect -- user report list is populated asynchronously from URL state. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { StatusBadge } from "@/components/ui/page-primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { readableApiError } from "@/lib/api/error-message";
import { formatJakartaDateTime } from "@/lib/format";

import {
  type FacilityReport,
  type ReportStatus,
  getMyReport,
  listMyReports,
} from "../api";
import { ReportDetailDrawer } from "./report-detail-drawer";

const statusOptions: Array<{ label: string; value?: ReportStatus }> = [
  { label: "Semua" },
  { label: "Baru", value: "NEW" },
  { label: "Diproses", value: "IN_PROGRESS" },
  { label: "Selesai", value: "RESOLVED" },
  { label: "Ditolak", value: "REJECTED" },
];

export function UserReportList() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, request, user } = useAuth();
  const statusParam = searchParams.get("status");
  const status = statusParam === "NEW" || statusParam === "IN_PROGRESS" || statusParam === "RESOLVED" || statusParam === "REJECTED" ? statusParam : undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const [reports, setReports] = useState<FacilityReport[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<FacilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listMyReports(request, { page, status });
      setReports(result.items);
      setMeta({ page: result.page, total: result.total, totalPages: result.totalPages });
      setError(null);
    } catch (reason) {
      setError(readableApiError(reason, "Gagal memuat laporan Anda."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && user?.role === "USER") void load();
    // request identity intentionally triggers reload after a refreshed session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, page, request, status, user?.role]);

  async function openDetail(reportId: string) {
    try {
      setSelected(await getMyReport(request, reportId));
      setError(null);
    } catch (reason) {
      setError(readableApiError(reason, "Detail laporan belum dapat dimuat."));
    }
  }

  function updateQuery(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value); else next.delete(key);
    });
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleStatusChange(nextStatus?: ReportStatus) {
    if (nextStatus === status) return;
    setLoading(true);
    updateQuery({ page: undefined, status: nextStatus });
  }

  if (!isReady || user?.role !== "USER") {
    return <main className="user-res-page"><div className="user-res-loading" role="status"><span className="slot-picker__spinner" aria-hidden="true" /><span>Memeriksa akses laporan…</span></div></main>;
  }

  return <main className="user-res-page">
    <div className="user-res-header">
      <div className="user-res-header__text">
        <nav aria-label="Breadcrumb" className="facility-breadcrumb user-res-breadcrumb">
          <Link href="/">Beranda</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Laporan Saya</span>
        </nav>
        <h1 className="user-res-title">Laporan Saya</h1>
      </div>
      <div className="user-res-header__actions">
        <Link className="button-primary user-res-new-btn" href="/reports/new">+ Buat laporan</Link>
      </div>
    </div>
    {searchParams.get("created") === "1" ? <div className="user-res-feedback-banner" role="status"><span className="user-res-feedback-banner__icon" aria-hidden="true">✓</span><span>Laporan berhasil dikirim dan menunggu tindak lanjut petugas.</span></div> : null}
    <div className="user-res-controls">
      <div aria-label="Filter status laporan" className="user-res-tabs" role="tablist">
        {statusOptions.map((item) => <button aria-selected={status === item.value} className={`user-res-tab ${status === item.value ? "is-active" : ""}`} key={item.label} onClick={() => handleStatusChange(item.value)} role="tab" type="button">{item.label}</button>)}
      </div>
    </div>
    {loading ? <div className="user-res-loading-list" role="status"><span className="slot-picker__spinner" aria-hidden="true" /><span>Memuat laporan Anda…</span></div> : error ? <div className="user-res-error-state" role="alert"><p>{error}</p><button className="button-primary" onClick={() => void load()} type="button">Coba Lagi</button></div> : reports.length ? <div className="user-res-list">
      <div className="user-res-list__meta"><span>Menampilkan <strong>{reports.length}</strong> laporan dari total {meta.total}</span></div>
      <div className="user-res-grid">
        {reports.map((report) => <article className="user-res-card user-report-card" key={report.id}>
          <div className="user-res-card__top">
            <div className="user-res-card__identity">
              <h2 className="user-res-card__title">{report.facility.name ?? report.facility.facilityGroupName}<span className="user-report-card__asset-code"> ({report.facility.assetCode})</span></h2>
            </div>
            <StatusBadge label={report.statusLabel} status={report.status} />
          </div>
          <span className="user-res-card__number">{report.reportNumber}</span>
          <div className="user-res-card__details">
            <span className="user-res-card__detail-item"><strong>{report.categoryLabel}</strong></span>
            <span className="user-res-card__detail-item"><span className="user-report-card__label">Dibuat</span>{formatJakartaDateTime(report.createdAt)}</span>
          </div>
          <span className="user-report-card__description">{report.description}</span>
          <div className="user-report-card__actions"><button onClick={() => void openDetail(report.id)} type="button">Lihat detail</button></div>
        </article>)}
      </div>
      {meta.totalPages > 1 ? <div className="user-res-pagination"><button disabled={page <= 1} onClick={() => updateQuery({ page: String(page - 1) })} type="button">Sebelumnya</button><span>Halaman {meta.page} dari {meta.totalPages}</span><button disabled={page >= meta.totalPages} onClick={() => updateQuery({ page: String(page + 1) })} type="button">Berikutnya</button></div> : null}
    </div> : <div className="user-res-empty-state">
      <div className="user-res-empty-state__icon" aria-hidden="true"><svg fill="none" height="40" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg></div>
      <h2 className="user-res-empty-state__title">Belum Ada Laporan</h2>
      <p className="user-res-empty-state__desc">Jika menemukan kendala pada fasilitas kampus, kirim laporan beserta foto bukti.</p>
      <Link className="button-primary user-res-empty-state__btn" href="/reports/new">Buat laporan</Link>
    </div>}
    {selected ? <ReportDetailDrawer onClose={() => setSelected(null)} presentation="centered" report={selected} /> : null}
  </main>;
}
