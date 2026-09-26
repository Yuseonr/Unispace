"use client";
/* eslint-disable react-hooks/set-state-in-effect -- URL-driven async queries intentionally update local request state. */

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination, StatusBadge } from "@/components/ui/page-primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { readableApiError } from "@/lib/api/error-message";
import { displayOptionalText, formatJakartaDate, formatJakartaDateTime } from "@/lib/format";
import {
  approveStaffReservation,
  cancelStaffReservation,
  fetchStaffReservations,
  formatSlotTime,
  rejectStaffReservation,
  triggerAutoRejectExpired,
} from "@/features/reservations/api";
import { StaffApproveModal } from "@/features/reservations/components/staff-approve-modal";
import { StaffCancelModal } from "@/features/reservations/components/staff-cancel-modal";
import { StaffRejectModal } from "@/features/reservations/components/staff-reject-modal";
import type { ReservationStatus, StaffReservationItem, StaffReservationsResponse } from "@/features/reservations/types";

type QueueTab = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
type Area = { id: string; name: string };

const tabs: Array<{ label: string; value: QueueTab }> = [
  { label: "Menunggu", value: "PENDING" }, { label: "Disetujui", value: "APPROVED" }, { label: "Ditolak", value: "REJECTED" }, { label: "Dibatalkan", value: "CANCELLED" }, { label: "Selesai", value: "COMPLETED" }, { label: "Semua", value: "ALL" },
];

function queueTab(value: string | null): QueueTab {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED" || value === "CANCELLED" || value === "COMPLETED" ? value : "ALL";
}

function StaffReservationsContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, request, user } = useAuth();
  const tab = queueTab(searchParams.get("status"));
  const date = searchParams.get("date") ?? "";
  const areaId = searchParams.get("areaId") ?? "";
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const [searchDraft, setSearchDraft] = useState(search);
  const [areas, setAreas] = useState<Area[]>([]);
  const [data, setData] = useState<StaffReservationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [triggeringSla, setTriggeringSla] = useState(false);
  const [approving, setApproving] = useState<StaffReservationItem | null>(null);
  const [rejecting, setRejecting] = useState<StaffReservationItem | null>(null);
  const [cancelling, setCancelling] = useState<StaffReservationItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchDraft.trim() !== search) updateQuery({ page: undefined, search: searchDraft.trim() || undefined });
    }, 300);
    return () => window.clearTimeout(timeout);
    // The text box debounces into the URL; query state remains shareable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => {
    if (!isReady || user?.role !== "STAFF") return;
    request<Area[]>("/facilities/areas").then(setAreas).catch(() => undefined);
  }, [isReady, request, user?.role]);

  const load = async () => {
    setLoading(true);
    const status: ReservationStatus | undefined = tab === "PENDING" || tab === "APPROVED" || tab === "REJECTED" || tab === "COMPLETED" ? tab : undefined;
    try {
      const result = await fetchStaffReservations({ facilityAreaId: areaId || undefined, limit: 20, page, search: search || undefined, status, usageDate: date || undefined, view: tab === "CANCELLED" ? "CANCELLED" : undefined }, request);
      setData(result);
      setError(null);
    } catch (reason) {
      setError(readableApiError(reason, "Antrean reservasi belum dapat dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && user?.role === "STAFF") void load();
    // URL filters and token refresh are the authoritative data dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, date, isReady, page, refresh, request, search, tab, user?.role]);

  function updateQuery(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value); else next.delete(key);
    });
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function resetAction() {
    setApproving(null); setRejecting(null); setCancelling(null); setActionError(null);
  }

  async function approve() {
    if (!approving) return;
    setBusy(true); setActionError(null);
    try {
      await approveStaffReservation(approving.id, {}, request);
      resetAction(); setNotice("Reservasi disetujui. Backend telah memeriksa ketersediaan dan alokasi ulang."); setRefresh((current) => current + 1); window.dispatchEvent(new Event("unispace:staff-queue-updated"));
    } catch (reason) { setActionError(readableApiError(reason, "Reservasi belum dapat disetujui.")); }
    finally { setBusy(false); }
  }

  async function reject(reason: string) {
    if (!rejecting) return;
    setBusy(true); setActionError(null);
    try {
      await rejectStaffReservation(rejecting.id, { reason }, request);
      resetAction(); setNotice("Reservasi ditolak dan alasannya dicatat."); setRefresh((current) => current + 1); window.dispatchEvent(new Event("unispace:staff-queue-updated"));
    } catch (reason) { setActionError(readableApiError(reason, "Reservasi belum dapat ditolak.")); }
    finally { setBusy(false); }
  }

  async function cancel(reason: string) {
    if (!cancelling) return;
    setBusy(true); setActionError(null);
    try {
      await cancelStaffReservation(cancelling.id, { reason }, request);
      resetAction(); setNotice("Reservasi dibatalkan oleh petugas dan slot dilepas."); setRefresh((current) => current + 1); window.dispatchEvent(new Event("unispace:staff-queue-updated"));
    } catch (reason) { setActionError(readableApiError(reason, "Reservasi belum dapat dibatalkan.")); }
    finally { setBusy(false); }
  }

  async function runSlaCheck() {
    setTriggeringSla(true); setNotice(null);
    try {
      const result = await triggerAutoRejectExpired(request);
      setNotice(`${result.processedCount} pengajuan melewati SLA diproses oleh backend.`); setRefresh((current) => current + 1); window.dispatchEvent(new Event("unispace:staff-queue-updated"));
    } catch (reason) { setError(readableApiError(reason, "Evaluasi SLA belum dapat dijalankan.")); }
    finally { setTriggeringSla(false); }
  }

  if (!isReady || user?.role !== "STAFF") return <main className="admin-page"><LoadingState label="Memeriksa akses petugas…" /></main>;

  return <section className="admin-page"><PageHeader action={<button className="admin-secondary-button" disabled={triggeringSla} onClick={() => void runSlaCheck()} type="button">{triggeringSla ? "Mengevaluasi…" : "Periksa SLA kedaluwarsa"}</button>} eyebrow="Operasional" title="Antrean Reservasi">Evaluasi pengajuan berdasarkan tujuan, jadwal, dan batas keputusan. Ketersediaan selalu diperiksa ulang oleh backend saat aksi dilakukan.</PageHeader>{notice ? <p className="ui-form-feedback" role="status">{notice}</p> : null}{error ? <p className="ui-form-feedback ui-form-feedback--error" role="alert">{error}</p> : null}<section className="ui-surface"><div aria-label="Filter status reservasi" className="report-status-tabs">{tabs.map((item) => <button className={tab === item.value ? "is-active" : ""} key={item.value} onClick={() => updateQuery({ page: undefined, status: item.value === "ALL" ? undefined : item.value })} type="button">{item.label}</button>)}</div><div className="ui-toolbar"><div className="ui-toolbar__filters"><label className="ui-field ui-field--search"><span>Cari</span><input onChange={(event) => setSearchDraft(event.target.value)} placeholder="Pemohon, fasilitas, atau tujuan" type="search" value={searchDraft} /></label><label className="ui-field"><span>Tanggal pemakaian</span><input onChange={(event) => updateQuery({ date: event.target.value || undefined, page: undefined })} type="date" value={date} /></label><label className="ui-field"><span>Area kampus</span><select onChange={(event) => updateQuery({ areaId: event.target.value || undefined, page: undefined })} value={areaId}><option value="">Semua area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label></div></div>{loading ? <LoadingState label="Memuat antrean reservasi…" /> : error && !data ? <ErrorState error={error} onRetry={() => void load()} /> : !data?.data.length ? <EmptyState description="Ubah filter atau periksa kembali nanti." title="Tidak ada reservasi" /> : <><div className="report-table-wrap"><table className="report-table staff-reservation-table"><thead><tr><th>Pemohon</th><th>Target</th><th>Jadwal</th><th>Tujuan</th><th>SLA</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{data.data.map((reservation) => { const target = reservation.facility?.name ?? reservation.facilityGroup?.name ?? "Fasilitas"; const quantity = reservation.facilityGroupId ? ` · ${reservation.requestedQuantity} unit` : ""; return <tr key={reservation.id}><td><strong>{reservation.user.name}</strong><br /><small>{reservation.user.identityNumber}</small></td><td>{target}<br /><small>{reservation.facilityGroupId ? "Kelompok alat" : "Ruang eksklusif"}{quantity}</small></td><td>{formatJakartaDate(reservation.usageDate)}<br /><small>{formatSlotTime(reservation.startTime)}–{formatSlotTime(reservation.endTime)} WIB</small></td><td>{displayOptionalText(reservation.purpose)}</td><td>{reservation.status === "PENDING" ? formatJakartaDateTime(reservation.decisionDeadline) : "—"}</td><td><StatusBadge status={reservation.status} /></td><td><div className="staff-row-actions"><Link className="report-action-link" href={`/staff/reservations/${reservation.id}`}>Rincian</Link>{reservation.status === "PENDING" ? <><button className="staff-action-approve" onClick={() => { setApproving(reservation); setActionError(null); }} type="button">Setujui</button><button className="staff-action-reject" onClick={() => { setRejecting(reservation); setActionError(null); }} type="button">Tolak</button></> : null}{reservation.status === "APPROVED" ? <button className="staff-action-reject" onClick={() => { setCancelling(reservation); setActionError(null); }} type="button">Batalkan</button> : null}</div></td></tr>; })}</tbody></table></div><Pagination onPageChange={(nextPage) => updateQuery({ page: String(nextPage) })} page={data.meta.page} total={data.meta.total} totalPages={data.meta.totalPages} /></>}</section><StaffApproveModal error={actionError} isOpen={Boolean(approving)} isSubmitting={busy} onClose={() => !busy && resetAction()} onConfirm={approve} reservation={approving} /><StaffRejectModal error={actionError} isOpen={Boolean(rejecting)} isSubmitting={busy} onClose={() => !busy && resetAction()} onConfirm={reject} reservation={rejecting} /><StaffCancelModal error={actionError} isOpen={Boolean(cancelling)} isSubmitting={busy} onClose={() => !busy && resetAction()} onConfirm={cancel} reservation={cancelling} /></section>;
}

export default function StaffReservationsPage() {
  return <Suspense><StaffReservationsContent /></Suspense>;
}
