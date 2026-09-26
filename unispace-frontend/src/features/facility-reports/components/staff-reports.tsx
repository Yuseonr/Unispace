"use client";
/* eslint-disable react-hooks/set-state-in-effect -- report detail and list state are asynchronously synchronized with API and URL state. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, LoadingState, PageHeader, Pagination, StatusBadge } from "@/components/ui/page-primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { readableApiError } from "@/lib/api/error-message";
import { formatJakartaDateTime, todayJakarta } from "@/lib/format";

import {
  type FacilityReport,
  type MaintenanceInput,
  type MaintenanceMode,
  type MaintenancePreview,
  type ReportAuditItem,
  type ReportStatus,
  acceptStaffReport,
  confirmMaintenance,
  endMaintenance,
  getStaffReport,
  listReportAudit,
  listStaffReports,
  previewMaintenance,
  rejectStaffReport,
  resolveStaffReport,
} from "../api";
import { ReportDetailDrawer } from "./report-detail-drawer";

const statusOptions: Array<{ label: string; value?: ReportStatus }> = [
  { label: "Semua" }, { label: "Baru", value: "NEW" }, { label: "Diproses", value: "IN_PROGRESS" }, { label: "Selesai", value: "RESOLVED" }, { label: "Ditolak", value: "REJECTED" },
];

function randomKey() { return crypto.randomUUID(); }

export function StaffReports() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, request, user } = useAuth();
  const requestedReportId = searchParams.get("reportId");
  const statusParam = searchParams.get("status");
  const status: ReportStatus | undefined = statusParam === "ALL" ? undefined : statusParam === "NEW" || statusParam === "IN_PROGRESS" || statusParam === "RESOLVED" || statusParam === "REJECTED" ? statusParam : "NEW";
  const search = searchParams.get("search") ?? "";
  const createdFrom = searchParams.get("createdFrom") ?? "";
  const createdTo = searchParams.get("createdTo") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const [searchDraft, setSearchDraft] = useState(search);
  const [reports, setReports] = useState<FacilityReport[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<FacilityReport | null>(null);
  const [audit, setAudit] = useState<ReportAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"reject" | "resolve" | "maintenance" | `end:${string}` | null>(null);
  const [reason, setReason] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceMode>("DATE_RANGE");
  const [maintenanceStart, setMaintenanceStart] = useState("");
  const [maintenanceEnd, setMaintenanceEnd] = useState("");
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [maintenanceStartTime, setMaintenanceStartTime] = useState("07:00");
  const [maintenanceEndTime, setMaintenanceEndTime] = useState("08:00");
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [preview, setPreview] = useState<MaintenancePreview | null>(null);

  useEffect(() => setSearchDraft(search), [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchDraft.trim() !== search) updateQuery({ page: undefined, search: searchDraft.trim() || undefined });
    }, 300);
    return () => window.clearTimeout(timeout);
    // Debounce only the local search input; the URL remains the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listStaffReports(request, { createdFrom: createdFrom || undefined, createdTo: createdTo || undefined, page, search: search.trim() || undefined, status });
      setReports(result.items);
      setMeta({ page: result.page, total: result.total, totalPages: result.totalPages });
      setError(null);
    } catch (reason) { setError(readableApiError(reason, "Antrean laporan belum dapat dimuat.")); }
    finally { setLoading(false); }
  };

  function updateQuery(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value); else next.delete(key);
    });
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!isReady || user?.role !== "STAFF") return;
    const timeout = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timeout);
    // request must reload after access-token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdFrom, createdTo, isReady, page, request, search, status, user?.role]);

  async function openDetail(reportId: string) {
    setError(null);
    try {
      const [report, auditData] = await Promise.all([getStaffReport(request, reportId), listReportAudit(request, reportId)]);
      setSelected(report);
      setAudit(auditData.items);
      setPreview(null);
      setReason("");
      setResolutionNote("");
    } catch (reason) { setError(readableApiError(reason, "Detail laporan belum dapat dimuat.")); }
  }

  useEffect(() => {
    if (isReady && user?.role === "STAFF" && requestedReportId && selected?.id !== requestedReportId) {
      void openDetail(requestedReportId);
    }
    // Direct links from the maintenance board should open the source report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, requestedReportId, user?.role]);

  async function refreshSelected() {
    if (!selected) return;
    await openDetail(selected.id);
    await load();
  }

  async function accept() {
    if (!selected) return;
    setBusy(true);
    try { await acceptStaffReport(request, selected.id); window.dispatchEvent(new Event("unispace:staff-queue-updated")); setNotice("Laporan diterima dan masuk status Diproses."); await refreshSelected(); }
    catch (reason) { setError(readableApiError(reason, "Laporan belum dapat diterima.")); }
    finally { setBusy(false); }
  }

  async function reject() {
    if (!selected || !reason.trim()) return;
    setBusy(true);
    try { await rejectStaffReport(request, selected.id, reason.trim()); window.dispatchEvent(new Event("unispace:staff-queue-updated")); setDialog(null); setNotice("Laporan ditolak dengan alasan yang dicatat."); await refreshSelected(); }
    catch (reason) { setError(readableApiError(reason, "Laporan belum dapat ditolak.")); }
    finally { setBusy(false); }
  }

  async function resolve() {
    if (!selected || !resolutionNote.trim()) return;
    setBusy(true);
    try { await resolveStaffReport(request, selected.id, resolutionNote.trim()); window.dispatchEvent(new Event("unispace:staff-queue-updated")); setDialog(null); setNotice("Laporan ditandai selesai."); await refreshSelected(); }
    catch (reason) { setError(readableApiError(reason, "Laporan belum dapat diselesaikan.")); }
    finally { setBusy(false); }
  }

  function maintenanceInput(): MaintenanceInput | null {
    if (maintenanceMode === "DATE_RANGE") {
      return maintenanceStart && maintenanceEnd ? { mode: maintenanceMode, startDate: maintenanceStart, endDate: maintenanceEnd } : null;
    }
    return maintenanceDate && maintenanceStartTime && maintenanceEndTime ? { mode: maintenanceMode, date: maintenanceDate, startTime: maintenanceStartTime, endTime: maintenanceEndTime } : null;
  }

  async function createPreview() {
    if (!selected) return;
    const input = maintenanceInput();
    if (!input) { setError("Lengkapi jadwal maintenance sesuai mode yang dipilih."); return; }
    setBusy(true);
    try { setPreview(await previewMaintenance(request, selected.id, input)); setError(null); }
    catch (reason) { setError(readableApiError(reason, "Dampak maintenance belum dapat dihitung.")); }
    finally { setBusy(false); }
  }

  async function confirmPreview() {
    if (!selected || !preview || !reason.trim()) return;
    const input = maintenanceInput();
    if (!input) return;
    setBusy(true);
    try {
      await confirmMaintenance(request, selected.id, { ...input, cancelImpactedReservations: true, cancellationReason: reason.trim(), note: maintenanceNote.trim() || undefined }, randomKey());
      window.dispatchEvent(new Event("unispace:staff-queue-updated"));
      setDialog(null);
      setPreview(null);
      setReason("");
      setNotice("Jadwal maintenance dikonfirmasi dan dampak reservasi diproses backend.");
      await refreshSelected();
    } catch (reason) { setError(readableApiError(reason, "Maintenance belum dapat dikonfirmasi.")); }
    finally { setBusy(false); }
  }

  async function endEarly(periodId: string) {
    setBusy(true);
    try { await endMaintenance(request, periodId); window.dispatchEvent(new Event("unispace:staff-queue-updated")); setDialog(null); setNotice("Periode perbaikan diakhiri lebih awal."); await refreshSelected(); }
    catch (reason) { setError(readableApiError(reason, "Periode belum dapat diakhiri.")); }
    finally { setBusy(false); }
  }

  if (!isReady || user?.role !== "STAFF") return <main className="admin-loading"><LoadingState label="Memeriksa akses petugas…" /></main>;

  const activePeriods = selected?.maintenancePeriods.filter((period) => new Date(period.startAt) <= new Date() && new Date(period.endAt) > new Date()) ?? [];
  const actionPanel = selected?.status === "NEW" ? <div className="report-action-grid"><button className="admin-primary-button" disabled={busy} onClick={() => void accept()} type="button">{busy ? "Memproses…" : "Terima laporan"}</button><button className="report-danger-button" disabled={busy} onClick={() => setDialog("reject")} type="button">Tolak laporan</button></div> : selected?.status === "IN_PROGRESS" ? <div className="report-action-grid"><button className="admin-primary-button" disabled={busy} onClick={() => setDialog("resolve")} type="button">Selesaikan laporan</button><section className="maintenance-wizard"><h3>Jadwalkan perbaikan</h3><p>{maintenanceMode === "DATE_RANGE" ? "Rentang tanggal menutup penuh pukul 07.00–20.00 WIB." : "Rentang waktu hanya satu tanggal, dengan batas slot 30 menit antara 07.00–20.00 WIB."}</p><div className="report-status-tabs"><button className={maintenanceMode === "DATE_RANGE" ? "is-active" : ""} onClick={() => { setMaintenanceMode("DATE_RANGE"); setPreview(null); }} type="button">Rentang tanggal</button><button className={maintenanceMode === "TIME_RANGE" ? "is-active" : ""} onClick={() => { setMaintenanceMode("TIME_RANGE"); setPreview(null); }} type="button">Rentang waktu</button></div>{maintenanceMode === "DATE_RANGE" ? <div className="maintenance-fields"><label className="ui-form-field"><span>Tanggal mulai</span><input min={todayJakarta()} onChange={(event) => { setMaintenanceStart(event.target.value); setPreview(null); }} type="date" value={maintenanceStart} /></label><label className="ui-form-field"><span>Tanggal selesai</span><input min={maintenanceStart || todayJakarta()} onChange={(event) => { setMaintenanceEnd(event.target.value); setPreview(null); }} type="date" value={maintenanceEnd} /></label></div> : <div className="maintenance-fields"><label className="ui-form-field"><span>Tanggal</span><input min={todayJakarta()} onChange={(event) => { setMaintenanceDate(event.target.value); setPreview(null); }} type="date" value={maintenanceDate} /></label><label className="ui-form-field"><span>Mulai</span><input min="07:00" onChange={(event) => { setMaintenanceStartTime(event.target.value); setPreview(null); }} step="1800" type="time" value={maintenanceStartTime} /></label><label className="ui-form-field"><span>Selesai</span><input max="20:00" min={maintenanceStartTime} onChange={(event) => { setMaintenanceEndTime(event.target.value); setPreview(null); }} step="1800" type="time" value={maintenanceEndTime} /></label></div>}<label className="ui-form-field"><span>Catatan perbaikan (opsional)</span><textarea onChange={(event) => setMaintenanceNote(event.target.value)} value={maintenanceNote} /></label><button className="admin-secondary-button" disabled={busy} onClick={() => void createPreview()} type="button">{busy ? "Menghitung…" : "Pratinjau dampak"}</button>{preview ? <div className="maintenance-preview"><strong>Dampak maintenance</strong><span>{preview.approvedReservations.length} reservasi disetujui akan dibatalkan dan {preview.pendingReservations.length} reservasi pending akan ditolak bila tidak lagi memungkinkan.</span>{preview.approvedReservations.length ? <ul><li><strong>Reservasi disetujui terdampak</strong></li>{preview.approvedReservations.map((reservation) => <li key={reservation.id}>{reservation.usageDate.slice(0, 10)} · {reservation.startTime.slice(11, 16)}–{reservation.endTime.slice(11, 16)} WIB</li>)}</ul> : null}{preview.pendingReservations.length ? <ul><li><strong>Reservasi pending yang akan ditolak</strong></li>{preview.pendingReservations.map((reservation) => <li key={reservation.id}>{reservation.usageDate.slice(0, 10)} · {reservation.startTime.slice(11, 16)}–{reservation.endTime.slice(11, 16)} WIB · {reservation.requestedQuantity} unit</li>)}</ul> : null}<button className="admin-primary-button" onClick={() => setDialog("maintenance")} type="button">Lanjutkan konfirmasi</button></div> : null}</section>{activePeriods.map((period) => <button className="report-danger-button" disabled={busy} key={period.id} onClick={() => setDialog(`end:${period.id}`)} type="button">Akhiri perbaikan aktif lebih awal</button>)}</div> : null;

  return <section className="admin-page"><PageHeader action={<Link className="admin-secondary-button" href="/staff/reservations">Antrean reservasi</Link>} eyebrow="Operasional" title="Antrean Laporan Kendala">Terima, tolak, selesaikan, dan jadwalkan perbaikan dari laporan pengguna.</PageHeader>{notice ? <p className="ui-form-feedback" role="status">{notice}</p> : null}{error ? <p className="ui-form-feedback ui-form-feedback--error" role="alert">{error}</p> : null}<section className="ui-surface"><div className="ui-toolbar"><div className="ui-toolbar__filters"><label className="ui-field ui-field--search"><span>Cari</span><input onChange={(event) => setSearchDraft(event.target.value)} placeholder="Nomor laporan, aset, fasilitas" type="search" value={searchDraft} /></label><label className="ui-field"><span>Status</span><select onChange={(event) => updateQuery({ page: undefined, status: event.target.value || "ALL" })} value={status ?? ""}>{statusOptions.map((item) => <option key={item.label} value={item.value ?? ""}>{item.label}</option>)}</select></label><label className="ui-field"><span>Dibuat dari</span><input onChange={(event) => updateQuery({ createdFrom: event.target.value || undefined, page: undefined })} type="date" value={createdFrom} /></label><label className="ui-field"><span>Sampai</span><input min={createdFrom} onChange={(event) => updateQuery({ createdTo: event.target.value || undefined, page: undefined })} type="date" value={createdTo} /></label></div></div>{loading ? <LoadingState label="Memuat antrean laporan…" /> : error && !reports.length ? <ErrorState error={error} onRetry={() => void load()} /> : reports.length ? <><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Nomor laporan</th><th>Fasilitas</th><th>Kategori</th><th>Pelapor</th><th>Dibuat</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td><strong>{report.reportNumber}</strong></td><td>{report.facility.assetCode}<br /><small>{report.facility.name ?? report.facility.facilityGroupName}</small></td><td>{report.categoryLabel}</td><td>{report.reporter?.name ?? "—"}</td><td>{formatJakartaDateTime(report.createdAt)}</td><td><StatusBadge label={report.statusLabel} status={report.status} /></td><td><button onClick={() => void openDetail(report.id)} type="button">Rincian</button></td></tr>)}</tbody></table></div><Pagination onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })} page={meta.page} total={meta.total} totalPages={meta.totalPages} /></> : <div className="ui-state ui-state--empty"><strong>Tidak ada laporan</strong><span>Ubah filter untuk melihat laporan lain.</span></div>}</section>{selected ? <ReportDetailDrawer actions={actionPanel} audit={audit} onClose={() => setSelected(null)} report={selected} showReporter /> : null}
    <ConfirmDialog confirmLabel="Tolak laporan" destructive error={!reason.trim() ? "Alasan penolakan wajib diisi." : null} isOpen={dialog === "reject"} onClose={() => !busy && setDialog(null)} onConfirm={() => void reject()} title="Tolak laporan"><label className="ui-form-field"><span>Alasan penolakan</span><textarea onChange={(event) => setReason(event.target.value)} value={reason} /></label></ConfirmDialog>
    <ConfirmDialog confirmLabel="Selesaikan laporan" error={!resolutionNote.trim() ? "Catatan penyelesaian wajib diisi." : null} isOpen={dialog === "resolve"} onClose={() => !busy && setDialog(null)} onConfirm={() => void resolve()} title="Selesaikan laporan"><label className="ui-form-field"><span>Catatan penyelesaian</span><textarea onChange={(event) => setResolutionNote(event.target.value)} value={resolutionNote} /></label><p>Pastikan tidak ada maintenance aktif atau terjadwal sebelum menandai laporan selesai.</p></ConfirmDialog>
    <ConfirmDialog confirmLabel="Konfirmasi perbaikan" destructive error={!reason.trim() ? "Alasan pembatalan wajib diisi." : null} isOpen={dialog === "maintenance"} onClose={() => !busy && setDialog(null)} onConfirm={() => void confirmPreview()} title={`Konfirmasi perbaikan dan batalkan ${preview?.approvedReservations.length ?? 0} reservasi`}><p>Backend akan menolak reservasi pending yang tidak lagi memungkinkan setelah maintenance diterapkan.</p><label className="ui-form-field"><span>Alasan pembatalan reservasi terdampak</span><textarea onChange={(event) => setReason(event.target.value)} value={reason} /></label></ConfirmDialog>
    <ConfirmDialog confirmLabel="Akhiri perbaikan" destructive isOpen={dialog?.startsWith("end:") ?? false} onClose={() => !busy && setDialog(null)} onConfirm={() => { if (dialog?.startsWith("end:")) void endEarly(dialog.slice(4)); }} title="Akhiri perbaikan lebih awal"><p>Hanya periode yang sedang aktif dapat diakhiri. Status efektif fasilitas akan dihitung ulang oleh backend.</p></ConfirmDialog>
  </section>;
}
