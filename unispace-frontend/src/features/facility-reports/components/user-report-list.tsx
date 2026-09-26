"use client";
/* eslint-disable react-hooks/set-state-in-effect -- user report list is populated asynchronously from URL state. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui/page-primitives";
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

  if (!isReady || user?.role !== "USER") {
    return <main className="user-res-page"><LoadingState label="Memeriksa akses laporan…" /></main>;
  }

  return <main className="user-res-page">
    <PageHeader action={<Link className="button-primary" href="/reports/new">+ Buat laporan</Link>} eyebrow="Pelaporan fasilitas" title="Laporan Saya">Pantau tindak lanjut laporan fasilitas dan bukti foto yang Anda kirim.</PageHeader>
    {searchParams.get("created") === "1" ? <p className="ui-form-feedback" role="status">Laporan berhasil dikirim dan menunggu tindak lanjut petugas.</p> : null}
    <section className="ui-surface">
      <div aria-label="Filter status laporan" className="report-status-tabs">{statusOptions.map((item) => <button aria-pressed={status === item.value} className={status === item.value ? "is-active" : ""} key={item.label} onClick={() => updateQuery({ page: undefined, status: item.value })} type="button">{item.label}</button>)}</div>
      {loading ? <LoadingState label="Memuat laporan…" /> : error ? <ErrorState error={error} onRetry={() => void load()} /> : reports.length ? <>
        <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Nomor</th><th>Fasilitas</th><th>Kategori</th><th>Dibuat</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td><strong>{report.reportNumber}</strong></td><td>{report.facility.assetCode} · {report.facility.name ?? report.facility.facilityGroupName}</td><td>{report.categoryLabel}</td><td>{formatJakartaDateTime(report.createdAt)}</td><td><StatusBadge label={report.statusLabel} status={report.status} /></td><td><button onClick={() => void openDetail(report.id)} type="button">Lihat detail</button></td></tr>)}</tbody></table></div>
        <Pagination onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })} page={meta.page} total={meta.total} totalPages={meta.totalPages} />
      </> : <div className="ui-state ui-state--empty"><strong>Belum ada laporan</strong><span>Jika menemukan kendala pada fasilitas kampus, kirim laporan beserta foto bukti.</span><Link className="button-primary" href="/reports/new">Buat laporan</Link></div>}
    </section>
    {selected ? <ReportDetailDrawer onClose={() => setSelected(null)} report={selected} /> : null}
  </main>;
}
