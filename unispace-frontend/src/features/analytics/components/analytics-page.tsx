"use client";
/* eslint-disable react-hooks/set-state-in-effect -- analytics requests synchronize async server state. */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui/page-primitives";
import { useAuth } from "@/features/auth/auth-provider";
import type {
  AdminFacilityArea,
  AdminFacilityType,
} from "@/features/facilities/admin-types";
import { readableApiError } from "@/lib/api/error-message";
import {
  formatJakartaDateTime,
  formatNumber,
  formatPercent,
  todayJakarta,
} from "@/lib/format";

import {
  analyticsQuery,
  getAnalytics,
  type AnalyticsFilters,
  type AnalyticsRow,
  type AnalyticsSummary,
  type DamageAnalytics,
  type EquipmentAnalytics,
  type OccupancyAnalytics,
  type ReportHistory,
  type TrendAnalytics,
} from "../api";

type Tab = "summary" | "history";
type DashboardRange = "all" | "today" | "7d" | "1m" | "3m";
type ExportFormat = "pdf" | "csv" | "xlsx";
type ExportReport = "summary" | "facility-report-history";
type DashboardIconName = "calendar" | "clock" | "report" | "building" | "users" | "staff" | "area" | "type";

const DASHBOARD_RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: "today", label: "Hari ini" },
  { id: "7d", label: "7 hari" },
  { id: "1m", label: "1 bulan" },
  { id: "3m", label: "3 bulan" },
  { id: "all", label: "Semua waktu" },
];

type DashboardCatalogCounts = { users: number; staff: number; areas: number; facilityTypes: number };

function dashboardRangeStart(dateTo: string, range: DashboardRange) {
  const date = new Date(`${dateTo}T00:00:00Z`);
  if (range === "all") return dateTo;
  if (range === "today") return dateTo;
  if (range === "1m" || range === "3m") {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - (range === "3m" ? 3 : 1));
    const lastDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDayOfMonth));
    return date.toISOString().slice(0, 10);
  }
  date.setUTCDate(date.getUTCDate() - 6);
  return date.toISOString().slice(0, 10);
}

function maxRangeDays(from: string, to: string) {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function displayPercent(value: number | null | undefined) {
  return value == null ? "-" : formatPercent(value);
}

function capacityDescription(used: number, available: number, unit: string) {
  if (available > 0) {
    return `${formatNumber(used)} ${unit} terpakai dari ${formatNumber(available)} ${unit} tersedia.`;
  }
  return used > 0
    ? `${formatNumber(used)} ${unit} pemakaian tercatat, tetapi belum ada kapasitas operasional sebagai pembanding.`
    : `Belum ada ${unit} operasional pada periode ini.`;
}

function MiniBars({ rows }: { rows: Array<{ count?: number; label: string; percentage?: number | null }> }) {
  const highest = Math.max(...rows.map((row) => row.count ?? row.percentage ?? 0), 1);
  return (
    <div className="analytics-bars">
      {rows.map((row) => {
        const value = row.count ?? row.percentage ?? 0;
        return (
          <div className="analytics-bars__row" key={row.label}>
            <span>{row.label}</span>
            <div aria-label={`${row.label}: ${value}`} role="img">
              <i style={{ width: `${Math.max(3, (value / highest) * 100)}%` }} />
            </div>
            <strong>{row.count !== undefined ? formatNumber(row.count) : displayPercent(row.percentage)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const paths: Record<DashboardIconName, ReactNode> = {
    calendar: <><rect height="16" rx="2" width="18" x="3" y="5" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 18h7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    report: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
    building: <><path d="M4 21V5l8-2v18M12 9h8v12M2 21h20" /><path d="M7 8h2M7 12h2M7 16h2M16 12h1M16 16h1" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6v1.4" /></>,
    staff: <><rect height="14" rx="2" width="18" x="3" y="7" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    area: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    type: <><path d="M20 13 11 22l-9-9V2h11z" /><circle cx="7" cy="7" r="1.5" /></>,
  };
  return <svg aria-hidden="true" className="analytics-metric__icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function MetricCard({ icon, label, value, helper }: { helper: string; icon: DashboardIconName; label: string; value: string }) {
  return <article className="analytics-metric"><div className="analytics-metric__top"><span>{label}</span><DashboardIcon name={icon} /></div><strong>{value}</strong><small>{helper}</small></article>;
}

export function AnalyticsPage({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { download, isReady, request, user } = useAuth();
  const [tab, setTab] = useState<Tab>("summary");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyAnalytics | null>(null);
  const [equipment, setEquipment] = useState<EquipmentAnalytics | null>(null);
  const [damage, setDamage] = useState<DamageAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendAnalytics | null>(null);
  const [history, setHistory] = useState<ReportHistory | null>(null);
  const [dashboardCatalogCounts, setDashboardCatalogCounts] = useState<DashboardCatalogCounts | null>(null);
  const [dashboardCatalogLoading, setDashboardCatalogLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dashboardRange = useMemo<DashboardRange>(() => {
    const selected = searchParams.get("range");
    return DASHBOARD_RANGES.find((range) => range.id === selected)?.id ?? (compact ? "all" : "1m");
  }, [compact, searchParams]);
  const filters = useMemo<AnalyticsFilters>(() => {
    const dateTo = todayJakarta();
    return {
      dateFrom: dashboardRangeStart(dateTo, dashboardRange),
      dateTo,
      allTime: dashboardRange === "all" ? true : undefined,
    };
  }, [dashboardRange]);
  const historyPage = Math.max(1, Number(searchParams.get("historyPage") ?? "1") || 1);

  useEffect(() => {
    if (!compact || !isReady || user?.role !== "ADMIN") return;
    let active = true;
    Promise.all([
      request<{ total: number }>("/admin/users?limit=1&role=USER"),
      request<{ total: number }>("/admin/users?limit=1&role=STAFF"),
      request<AdminFacilityArea[]>("/admin/facilities/areas"),
      request<AdminFacilityType[]>("/admin/facilities/types"),
    ]).then(([users, staff, nextAreas, nextTypes]) => {
      if (!active) return;
      setDashboardCatalogCounts({ users: users.total, staff: staff.total, areas: nextAreas.length, facilityTypes: nextTypes.length });
    }).catch(() => {
      if (active) setDashboardCatalogCounts(null);
    }).finally(() => {
      if (active) setDashboardCatalogLoading(false);
    });
    return () => { active = false; };
  }, [compact, isReady, request, user?.role]);

  const load = async () => {
    if (filters.dateFrom > filters.dateTo || (!filters.allTime && maxRangeDays(filters.dateFrom, filters.dateTo) > 366)) {
      setError(filters.dateFrom > filters.dateTo ? "Tanggal awal tidak boleh setelah tanggal akhir." : "Rentang analytics maksimal 366 hari.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [nextSummary, nextOccupancy, nextEquipment, nextDamage] = await Promise.all([
        getAnalytics<AnalyticsSummary>(request, "summary", filters),
        getAnalytics<OccupancyAnalytics>(request, "occupancy", filters),
        getAnalytics<EquipmentAnalytics>(request, "equipment-utilization", filters),
        getAnalytics<DamageAnalytics>(request, "damage-frequency", filters),
      ]);
      setSummary(nextSummary);
      setOccupancy(nextOccupancy);
      setEquipment(nextEquipment);
      setDamage(nextDamage);
      if (compact) {
        setTrends(null);
        setHistory(null);
      } else {
        const [nextTrends, nextHistory] = await Promise.all([
          getAnalytics<TrendAnalytics>(request, "trends", { ...filters, interval: dashboardRange === "all" ? "month" : "day", metric: "occupancy" }),
          getAnalytics<ReportHistory>(request, "facility-report-history", { ...filters, limit: 10, page: historyPage }),
        ]);
        setTrends(nextTrends);
        setHistory(nextHistory);
      }
      setError(null);
    } catch (reason) {
      setError(readableApiError(reason, "Analytics belum dapat dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && user?.role === "ADMIN") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, filters, isReady, request, user?.role]);

  function setDashboardRange(range: DashboardRange) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("range", range);
    ["dateFrom", "dateTo", "facilityAreaId", "facilityTypeId", "facilityGroupId", "facilityId", "reservationMode"].forEach((key) => next.delete(key));
    next.delete("historyPage");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setHistoryPage(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("historyPage", String(page));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function exportCurrent(format: ExportFormat, report: ExportReport) {
    setExporting(format);
    setNotice(null);
    try {
      const file = await download("/admin/analytics/export" + analyticsQuery({
        ...filters,
        format,
        report,
      }));
      setNotice(`Export ${file.filename ?? "analytics"} mulai diunduh.`);
    } catch (reason) {
      setError(readableApiError(reason, "Export belum dapat dibuat."));
    } finally {
      setExporting(null);
    }
  }

  if (!isReady || user?.role !== "ADMIN") {
    return <main className="admin-page"><LoadingState label="Memeriksa akses analytics…" /></main>;
  }

  const topDamageByType = damage?.byFacilityType.slice(0, 5).map((row) => ({ count: row.count, label: row.name })) ?? [];
  const trendRows = trends?.series.map((row) => ({ label: row.period, percentage: row.percentage ?? null })) ?? [];
  const reservationStatusRows = summary ? [
    { key: "PENDING", label: "Menunggu", value: summary.reservations.byStatus.PENDING ?? 0 },
    { key: "APPROVED", label: "Disetujui", value: summary.reservations.byStatus.APPROVED ?? 0 },
    { key: "COMPLETED", label: "Selesai", value: summary.reservations.byStatus.COMPLETED ?? 0 },
    { key: "REJECTED", label: "Ditolak", value: summary.reservations.byStatus.REJECTED ?? 0 },
    { key: "CANCELLED", label: "Dibatalkan", value: ["CANCELLED_BY_USER", "CANCELLED_BY_STAFF", "CANCELLED_BY_SYSTEM"].reduce((total, status) => total + (summary.reservations.byStatus[status] ?? 0), 0) },
  ] : [];
  const reportStatusRows = summary ? [
    { key: "NEW", label: "Baru", value: summary.reports.byStatus.NEW ?? 0 },
    { key: "IN_PROGRESS", label: "Diproses", value: summary.reports.byStatus.IN_PROGRESS ?? 0 },
    { key: "RESOLVED", label: "Selesai", value: summary.reports.byStatus.RESOLVED ?? 0 },
    { key: "REJECTED", label: "Ditolak", value: summary.reports.byStatus.REJECTED ?? 0 },
  ] : [];
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "summary", label: "Ringkasan" },
    ...(!compact ? [{ id: "history" as const, label: "Riwayat laporan" }] : []),
  ];

  return (
    <section className={`admin-page analytics-page${compact ? " analytics-page--dashboard" : ""}`}>
      <PageHeader title={compact ? "Dashboard" : "Rekap & Laporan"} />
      {notice ? <p className="ui-form-feedback" role="status">{notice}</p> : null}
      {error ? <p className="ui-form-feedback ui-form-feedback--error" role="alert">{error}</p> : null}
      <section className={`ui-surface${compact ? " analytics-dashboard-surface" : ""}`}>
        <div className="analytics-filter-bar analytics-filter-bar--dashboard">
          <div className="analytics-range-filter">
            <span>Periode</span>
            <div aria-label={compact ? "Pilih periode dashboard" : "Pilih periode laporan"} className="analytics-range-options" role="group">
              {DASHBOARD_RANGES.map((range) => <button aria-pressed={dashboardRange === range.id} className={dashboardRange === range.id ? "is-active" : ""} key={range.id} onClick={() => setDashboardRange(range.id)} type="button">{range.label}</button>)}
            </div>
          </div>
          {!compact ? <div aria-label="Tab analytics" className="report-status-tabs analytics-report-tabs">
            {tabs.map((item) => <button className={tab === item.id ? "is-active" : ""} key={item.id} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}
          </div> : null}
        </div>
        {loading ? <LoadingState label="Menghitung analytics…" /> : !summary || !occupancy || !equipment || !damage || (!compact && (!history || !trends)) ? <ErrorState error={error ?? "Data analytics belum tersedia."} onRetry={() => void load()} /> : <>
          {!compact && tab === "summary" ? <div className="analytics-export analytics-export--summary">
            <div className="analytics-export__copy">
              <strong>Unduh ringkasan lengkap</strong>
              <span>Memuat tabel seluruh reservasi, detail okupansi ruang, dan utilisasi alat sesuai periode.</span>
            </div>
            <div className="analytics-export__actions">
              {(["pdf", "csv", "xlsx"] as const).map((format) => <button disabled={Boolean(exporting)} key={format} onClick={() => void exportCurrent(format, "summary")} type="button">{exporting === format ? `Menyiapkan ${format.toUpperCase()}…` : format.toUpperCase()}</button>)}
            </div>
          </div> : null}
          {!compact && tab === "history" ? <div className="analytics-export">
            <div className="analytics-export__copy">
              <strong>Ekspor riwayat laporan</strong>
              <span>{history?.total ? "Unduh seluruh " + formatNumber(history.total) + " laporan sesuai periode, termasuk halaman berikutnya." : "Belum ada laporan untuk diekspor pada periode ini."}</span>
            </div>
            <div className="analytics-export__actions">
              {(["pdf", "csv", "xlsx"] as const).map((format) => <button disabled={Boolean(exporting) || !history?.total} key={format} onClick={() => void exportCurrent(format, "facility-report-history")} type="button">{exporting === format ? `Menyiapkan ${format.toUpperCase()}…` : format.toUpperCase()}</button>)}
            </div>
          </div> : null}
          {tab === "summary" ? <>
            <div className="analytics-metrics">
              <MetricCard helper={`${formatNumber(summary.reservations.approvedOrCompleted)} disetujui / selesai`} icon="calendar" label="Reservasi" value={formatNumber(summary.reservations.total)} />
              <MetricCard helper="Akumulasi reservasi disetujui dan selesai" icon="clock" label="Jam penggunaan" value={`${formatNumber(summary.reservations.totalUsedHours)} jam`} />
              <MetricCard helper={`${formatNumber(summary.reports.qualifyingDamageReports)} laporan kerusakan tercatat`} icon="report" label="Laporan fasilitas" value={formatNumber(summary.reports.total)} />
              <MetricCard helper={`${formatNumber(summary.facilities.currentNonactiveUnits)} unit saat ini nonaktif`} icon="building" label="Unit fasilitas" value={formatNumber(summary.facilities.totalUnits)} />
            </div>
            {compact ? <section className="analytics-catalog-counts">
              <div className="analytics-catalog-counts__heading"><h2>Akun & master fasilitas</h2><span>Data terdaftar saat ini</span></div>
              <div className="analytics-metrics">
                <MetricCard helper={dashboardCatalogLoading ? "Memuat data…" : dashboardCatalogCounts ? "Akun pengguna terdaftar" : "Data tidak dapat dimuat"} icon="users" label="User" value={dashboardCatalogLoading ? "…" : dashboardCatalogCounts ? formatNumber(dashboardCatalogCounts.users) : "-"} />
                <MetricCard helper={dashboardCatalogLoading ? "Memuat data…" : dashboardCatalogCounts ? "Akun petugas terdaftar" : "Data tidak dapat dimuat"} icon="staff" label="Petugas" value={dashboardCatalogLoading ? "…" : dashboardCatalogCounts ? formatNumber(dashboardCatalogCounts.staff) : "-"} />
                <MetricCard helper={dashboardCatalogLoading ? "Memuat data…" : dashboardCatalogCounts ? "Area kampus terdaftar" : "Data tidak dapat dimuat"} icon="area" label="Area" value={dashboardCatalogLoading ? "…" : dashboardCatalogCounts ? formatNumber(dashboardCatalogCounts.areas) : "-"} />
                <MetricCard helper={dashboardCatalogLoading ? "Memuat data…" : dashboardCatalogCounts ? "Jenis fasilitas terdaftar" : "Data tidak dapat dimuat"} icon="type" label="Jenis fasilitas" value={dashboardCatalogLoading ? "…" : dashboardCatalogCounts ? formatNumber(dashboardCatalogCounts.facilityTypes) : "-"} />
              </div>
            </section> : null}
            <div className="analytics-grid">
              <section className="analytics-panel analytics-panel--utilization"><h2>Okupansi ruang</h2><strong>{displayPercent(occupancy.percentage)}</strong><div aria-hidden="true" className="analytics-utilization-track"><i style={{ width: `${Math.max(0, Math.min(100, occupancy.percentage ?? 0))}%` }} /></div><p>{capacityDescription(occupancy.bookedSlots, occupancy.availableSlots, "slot")}</p></section>
              <section className="analytics-panel analytics-panel--utilization"><h2>Utilisasi alat</h2><strong>{displayPercent(equipment.percentage)}</strong><div aria-hidden="true" className="analytics-utilization-track"><i style={{ width: `${Math.max(0, Math.min(100, equipment.percentage ?? 0))}%` }} /></div><p>{capacityDescription(equipment.usedUnitSlots, equipment.availableUnitSlots, "unit-slot")}</p></section>
              <StatusSummary title="Status reservasi" rows={reservationStatusRows} />
              <StatusSummary title="Status laporan fasilitas" rows={reportStatusRows} />
              <section className="analytics-panel analytics-panel--wide"><h2>Tipe fasilitas dengan laporan terbanyak</h2>{topDamageByType.length ? <MiniBars rows={topDamageByType} /> : <EmptyState description="Belum ada laporan dalam periode ini." title="Tidak ada data laporan" />}</section>
            </div>
            {!compact ? <div className="analytics-detail-grid">
              <AnalyticsTable denominator="availableSlots" numerator="bookedSlots" rows={occupancy.facilities} title="Okupansi ruang per fasilitas" />
              <AnalyticsTable denominator="availableUnitSlots" numerator="usedUnitSlots" rows={equipment.facilityGroups} title="Utilisasi alat per kelompok" />
              <section className="analytics-panel analytics-panel--detail-chart"><h2>Frekuensi laporan kerusakan</h2>{damage.byCategory.length ? <MiniBars rows={damage.byCategory.map((row) => ({ count: row.count, label: row.label }))} /> : <EmptyState description="Belum ada laporan pada periode ini." title="Tidak ada data laporan" />}</section>
              <section className="analytics-panel analytics-panel--detail-chart"><h2>Tren okupansi {dashboardRange === "all" ? "bulanan" : "harian"}</h2>{trendRows.length ? <><MiniBars rows={trendRows} /><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Periode</th><th>Slot digunakan</th><th>Slot tersedia</th><th>Okupansi</th></tr></thead><tbody>{trends?.series.map((row) => <tr key={row.period}><td>{row.period}</td><td>{formatNumber(row.numerator)}</td><td>{formatNumber(row.denominator)}</td><td>{displayPercent(row.percentage)}</td></tr>)}</tbody></table></div></> : <EmptyState description="Belum ada tren pada periode ini." title="Tidak ada data tren" />}</section>
            </div> : null}
          </> : null}
          {tab === "history" && history ? <section className="analytics-panel">
            <div className="analytics-report-history-heading">
              <div><h2>Riwayat laporan fasilitas</h2><p>Menampilkan {formatNumber(history.items.length)} dari {formatNumber(history.total)} laporan yang sesuai filter.</p></div>
            </div>
            {history.items.length ? <>
              <div className="analytics-table-wrap">
                <table className="analytics-table analytics-report-history-table">
                  <thead><tr><th>Laporan</th><th>Fasilitas</th><th>Pelapor</th><th>Status & waktu</th></tr></thead>
                  <tbody>{history.items.map((item) => <tr key={item.id}>
                    <td><div className="analytics-report-history-cell"><strong>{item.reportNumber}</strong><small>{item.categoryLabel}</small><p>{item.description}</p></div></td>
                    <td><div className="analytics-report-history-cell"><strong>{item.facility.assetCode}<br />{item.facility.name}</strong><small>{item.facility.facilityGroup.name}</small><small>{item.facility.facilityType.name}</small><small>{item.facility.facilityArea.code}, {item.facility.facilityArea.name}</small></div></td>
                    <td>{item.reporter?.name ?? "-"}</td>
                    <td><div className="analytics-report-history-cell"><StatusBadge status={item.status} /><small>Dibuat {formatJakartaDateTime(item.createdAt)}</small>{item.resolutionHours !== null ? <small>Waktu penyelesaian {formatNumber(item.resolutionHours)} jam</small> : null}</div></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <Pagination onPageChange={setHistoryPage} page={history.page} total={history.total} totalPages={history.totalPages} />
            </> : <EmptyState description="Belum ada data pada periode dan filter yang dipilih." title="Belum ada riwayat laporan" />}
          </section> : null}
        </>}
      </section>
    </section>
  );
}

function AnalyticsTable({ denominator, numerator, rows, title }: { denominator: "availableSlots" | "availableUnitSlots"; numerator: "bookedSlots" | "usedUnitSlots"; rows: AnalyticsRow[]; title: string }) {
  const getMetric = (row: AnalyticsRow, metric: "availableSlots" | "availableUnitSlots" | "bookedSlots" | "usedUnitSlots") => row[metric] ?? 0;
  const usedTotal = rows.reduce((total, row) => total + getMetric(row, numerator), 0);
  const availableTotal = rows.reduce((total, row) => total + getMetric(row, denominator), 0);
  const totalPercentage = availableTotal > 0 ? (usedTotal / availableTotal) * 100 : null;
  const isEquipment = numerator === "usedUnitSlots";
  return (
    <section className="analytics-panel analytics-panel--table">
      <div className="analytics-table-heading">
        <div><h2>{title}</h2><p>{formatNumber(rows.length)} {isEquipment ? "kelompok alat" : "fasilitas"} dalam periode ini</p></div>
        <span className="analytics-table-heading__total">{displayPercent(totalPercentage)}<small>total terpakai</small></span>
      </div>
      {rows.length ? <div className="analytics-table-wrap">
        <table className="analytics-table analytics-detail-table">
          <thead><tr><th>Fasilitas / kelompok</th><th>Area dan tipe</th><th>Terpakai</th><th>Kapasitas</th><th>Persentase</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.assetCode ?? ""}-${row.name}`}>
            <td><div className="analytics-detail-table__facility">{row.assetCode ? <small>{row.assetCode}</small> : null}<strong>{row.name}</strong>{isEquipment && row.totalUnits !== undefined ? <small>{formatNumber(row.totalUnits)} unit, {formatNumber(row.currentNonactiveUnits ?? 0)} nonaktif</small> : null}{!isEquipment && row.currentStatus ? <small>{row.currentStatus === "ACTIVE" ? "Aktif" : "Nonaktif"}{row.historicalNonactive ? ", pernah nonaktif" : ""}</small> : null}</div></td>
            <td><div className="analytics-detail-table__metadata"><span>{row.facilityArea?.name ?? "Area tidak tersedia"}</span><small>{row.facilityType?.name ?? "Tipe tidak tersedia"}</small></div></td>
            <td className="analytics-detail-table__number">{formatNumber(getMetric(row, numerator))}<small>{isEquipment ? "unit-slot" : "slot"}</small></td>
            <td className="analytics-detail-table__number">{formatNumber(getMetric(row, denominator))}<small>{isEquipment ? "unit-slot" : "slot"}</small></td>
            <td><div className="analytics-detail-table__percentage"><strong>{displayPercent(row.percentage)}</strong><span aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, row.percentage ?? 0))}%` }} /></span></div></td>
          </tr>)}</tbody>
          <tfoot><tr><th>Total</th><td>{formatNumber(rows.length)} {isEquipment ? "kelompok alat" : "fasilitas"}</td><td className="analytics-detail-table__number">{formatNumber(usedTotal)}<small>{isEquipment ? "unit-slot" : "slot"}</small></td><td className="analytics-detail-table__number">{formatNumber(availableTotal)}<small>{isEquipment ? "unit-slot" : "slot"}</small></td><td className="analytics-detail-table__number">{displayPercent(totalPercentage)}</td></tr></tfoot>
        </table>
      </div> : <EmptyState description="Tidak ada data pada filter yang dipilih." title="Belum ada data" />}
    </section>
  );
}

function StatusSummary({ title, rows }: { title: string; rows: Array<{ key: string; label: string; value: number }> }) {
  return (
    <section className="analytics-panel analytics-status-summary">
      <h2>{title}</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            <span><i aria-hidden="true" data-status={row.key} />{row.label}</span>
            <strong>{formatNumber(row.value)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
