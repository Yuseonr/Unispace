"use client";
/* eslint-disable react-hooks/set-state-in-effect -- analytics requests synchronize async server state. */

import { useEffect, useMemo, useState } from "react";
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
  AdminFacilityGroup,
  AdminFacilityType,
} from "@/features/facilities/admin-types";
import { readableApiError } from "@/lib/api/error-message";
import {
  firstDayOfCurrentMonthJakarta,
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

type Tab = "summary" | "occupancy" | "equipment" | "damage" | "trends" | "history";

function maxRangeDays(from: string, to: string) {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function displayPercent(value: number | null | undefined) {
  return value == null ? "—" : formatPercent(value);
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

function MetricCard({ label, value, helper }: { helper: string; label: string; value: string }) {
  return <article className="analytics-metric"><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
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
  const [areas, setAreas] = useState<AdminFacilityArea[]>([]);
  const [types, setTypes] = useState<AdminFacilityType[]>([]);
  const [groups, setGroups] = useState<AdminFacilityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfOrientation, setPdfOrientation] = useState<"landscape" | "portrait">("landscape");
  const [notice, setNotice] = useState<string | null>(null);

  const filters = useMemo<AnalyticsFilters>(() => ({
    dateFrom: searchParams.get("dateFrom") ?? firstDayOfCurrentMonthJakarta(),
    dateTo: searchParams.get("dateTo") ?? todayJakarta(),
    facilityAreaId: searchParams.get("facilityAreaId") ?? undefined,
    facilityGroupId: searchParams.get("facilityGroupId") ?? undefined,
    facilityId: searchParams.get("facilityId") ?? undefined,
    facilityTypeId: searchParams.get("facilityTypeId") ?? undefined,
    reservationMode: (searchParams.get("reservationMode") as AnalyticsFilters["reservationMode"]) ?? undefined,
  }), [searchParams]);
  const historyPage = Math.max(1, Number(searchParams.get("historyPage") ?? "1") || 1);
  const selectableGroups = groups.filter((group) =>
    (!filters.facilityAreaId || group.facilityAreaId === filters.facilityAreaId) &&
    (!filters.facilityTypeId || group.facilityTypeId === filters.facilityTypeId),
  );
  const selectableUnits = selectableGroups
    .filter((group) => !filters.facilityGroupId || group.id === filters.facilityGroupId)
    .flatMap((group) => group.facilities.map((facility) => ({ ...facility, groupName: group.name })));

  useEffect(() => {
    if (!isReady || user?.role !== "ADMIN") return;
    Promise.all([
      request<AdminFacilityArea[]>("/admin/facilities/areas"),
      request<AdminFacilityType[]>("/admin/facilities/types"),
      request<AdminFacilityGroup[]>("/admin/facilities"),
    ]).then(([nextAreas, nextTypes, nextGroups]) => {
      setAreas(nextAreas);
      setTypes(nextTypes);
      setGroups(nextGroups);
    }).catch(() => undefined);
  }, [isReady, request, user?.role]);

  const load = async () => {
    if (filters.dateFrom > filters.dateTo || maxRangeDays(filters.dateFrom, filters.dateTo) > 366) {
      setError(filters.dateFrom > filters.dateTo ? "Tanggal awal tidak boleh setelah tanggal akhir." : "Rentang analytics maksimal 366 hari.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [nextSummary, nextOccupancy, nextEquipment, nextDamage, nextTrends, nextHistory] = await Promise.all([
        getAnalytics<AnalyticsSummary>(request, "summary", filters),
        getAnalytics<OccupancyAnalytics>(request, "occupancy", filters),
        getAnalytics<EquipmentAnalytics>(request, "equipment-utilization", filters),
        getAnalytics<DamageAnalytics>(request, "damage-frequency", filters),
        getAnalytics<TrendAnalytics>(request, "trends", { ...filters, interval: "day", metric: "occupancy" }),
        getAnalytics<ReportHistory>(request, "facility-report-history", { ...filters, limit: 10, page: historyPage }),
      ]);
      setSummary(nextSummary);
      setOccupancy(nextOccupancy);
      setEquipment(nextEquipment);
      setDamage(nextDamage);
      setTrends(nextTrends);
      setHistory(nextHistory);
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
  }, [filters, isReady, request, user?.role]);

  function setFilter(key: keyof AnalyticsFilters, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key === "facilityAreaId" || key === "facilityTypeId") {
      next.delete("facilityGroupId");
      next.delete("facilityId");
    }
    if (key === "facilityGroupId") next.delete("facilityId");
    next.delete("historyPage");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setHistoryPage(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("historyPage", String(page));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function exportCurrent(format: "csv" | "xlsx" | "pdf") {
    setExporting(true);
    setNotice(null);
    try {
      const report = tab === "equipment" ? "equipment-utilization" : tab === "damage" ? "damage-frequency" : tab === "trends" ? "trends" : tab === "history" ? "facility-report-history" : tab === "occupancy" ? "occupancy" : "summary";
      const file = await download(`/admin/analytics/export${analyticsQuery({
        ...filters,
        format,
        interval: "day",
        metric: tab === "damage" ? "damage-frequency" : tab === "equipment" ? "equipment-utilization" : "occupancy",
        orientation: format === "pdf" ? pdfOrientation : undefined,
        report,
      })}`);
      setNotice(`Export ${file.filename ?? "analytics"} mulai diunduh.`);
    } catch (reason) {
      setError(readableApiError(reason, "Export belum dapat dibuat."));
    } finally {
      setExporting(false);
    }
  }

  if (!isReady || user?.role !== "ADMIN") {
    return <main className="admin-page"><LoadingState label="Memeriksa akses analytics…" /></main>;
  }

  const topDamage = damage?.byFacility.slice(0, 5).map((row) => ({ count: row.count, label: `${row.assetCode} · ${row.name}` })) ?? [];
  const trendRows = trends?.series.map((row) => ({ label: row.period, percentage: row.percentage ?? null })) ?? [];
  const tabs: Array<{ id: Tab; label: string }> = compact
    ? [{ id: "summary", label: "Ringkasan" }]
    : [
      { id: "summary", label: "Ringkasan" },
      { id: "occupancy", label: "Okupansi" },
      { id: "equipment", label: "Utilisasi alat" },
      { id: "damage", label: "Frekuensi laporan" },
      { id: "trends", label: "Tren" },
      { id: "history", label: "Riwayat laporan" },
    ];

  return (
    <section className="admin-page">
      <PageHeader eyebrow="Analitik operasional" title={compact ? "Dashboard" : "Rekap & Laporan"}>
        <span>Periode {filters.dateFrom} — {filters.dateTo}. Seluruh metrik dihitung backend dari data operasional.</span>
      </PageHeader>
      {notice ? <p className="ui-form-feedback" role="status">{notice}</p> : null}
      {error ? <p className="ui-form-feedback ui-form-feedback--error" role="alert">{error}</p> : null}
      <section className="ui-surface">
        <div className="analytics-filter-bar">
          <label className="ui-field"><span>Dari</span><input onChange={(event) => setFilter("dateFrom", event.target.value)} type="date" value={filters.dateFrom} /></label>
          <label className="ui-field"><span>Sampai</span><input onChange={(event) => setFilter("dateTo", event.target.value)} type="date" value={filters.dateTo} /></label>
          {!compact ? <>
            <label className="ui-field"><span>Area</span><select onChange={(event) => setFilter("facilityAreaId", event.target.value)} value={filters.facilityAreaId ?? ""}><option value="">Semua area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
            <label className="ui-field"><span>Tipe</span><select onChange={(event) => setFilter("facilityTypeId", event.target.value)} value={filters.facilityTypeId ?? ""}><option value="">Semua tipe</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
            <label className="ui-field"><span>Kelompok</span><select onChange={(event) => setFilter("facilityGroupId", event.target.value)} value={filters.facilityGroupId ?? ""}><option value="">Semua kelompok</option>{selectableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label className="ui-field"><span>Unit</span><select onChange={(event) => setFilter("facilityId", event.target.value)} value={filters.facilityId ?? ""}><option value="">Semua unit</option>{selectableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.assetCode} · {unit.name ?? unit.groupName}</option>)}</select></label>
            <label className="ui-field"><span>Mode</span><select onChange={(event) => setFilter("reservationMode", event.target.value)} value={filters.reservationMode ?? ""}><option value="">Semua mode</option><option value="EXCLUSIVE">Ruang eksklusif</option><option value="QUANTITY">Alat</option></select></label>
          </> : null}
          <div className="analytics-export">
            <span>Export</span>
            <label><span className="sr-only">Orientasi PDF</span><select aria-label="Orientasi PDF" disabled={exporting} onChange={(event) => setPdfOrientation(event.target.value as "landscape" | "portrait")} value={pdfOrientation}><option value="landscape">PDF landscape</option><option value="portrait">PDF portrait</option></select></label>
            <button disabled={exporting} onClick={() => void exportCurrent("csv")} type="button">CSV</button>
            <button disabled={exporting} onClick={() => void exportCurrent("xlsx")} type="button">XLSX</button>
            <button disabled={exporting} onClick={() => void exportCurrent("pdf")} type="button">PDF</button>
          </div>
        </div>
        {loading ? <LoadingState label="Menghitung analytics…" /> : !summary || !occupancy || !equipment || !damage || !history ? <ErrorState error={error ?? "Data analytics belum tersedia."} onRetry={() => void load()} /> : <>
          <div aria-label="Tab analytics" className="report-status-tabs">
            {tabs.map((item) => <button className={tab === item.id ? "is-active" : ""} key={item.id} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}
          </div>
          {tab === "summary" ? <>
            <div className="analytics-metrics">
              <MetricCard helper={`${summary.reservations.approvedOrCompleted} disetujui / selesai`} label="Reservasi" value={formatNumber(summary.reservations.total)} />
              <MetricCard helper="Durasi pemakaian pada periode" label="Jam digunakan" value={`${formatNumber(summary.reservations.totalUsedHours)} jam`} />
              <MetricCard helper={`${summary.reports.qualifyingDamageReports} laporan operasional`} label="Laporan fasilitas" value={formatNumber(summary.reports.total)} />
              <MetricCard helper={`${summary.facilities.currentNonactiveUnits} unit saat ini nonaktif`} label="Unit fasilitas" value={formatNumber(summary.facilities.totalUnits)} />
            </div>
            <div className="analytics-grid">
              <section className="analytics-panel"><h2>Okupansi ruang</h2><strong>{displayPercent(occupancy.percentage)}</strong><p>{capacityDescription(occupancy.bookedSlots, occupancy.availableSlots, "slot")}</p></section>
              <section className="analytics-panel"><h2>Utilisasi alat</h2><strong>{displayPercent(equipment.percentage)}</strong><p>{capacityDescription(equipment.usedUnitSlots, equipment.availableUnitSlots, "unit-slot")}</p></section>
              <section className="analytics-panel analytics-panel--wide"><h2>Fasilitas dengan laporan terbanyak</h2>{topDamage.length ? <MiniBars rows={topDamage} /> : <EmptyState description="Belum ada laporan dalam periode ini." title="Tidak ada data laporan" />}</section>
            </div>
          </> : null}
          {tab === "occupancy" ? <AnalyticsTable denominator="availableSlots" numerator="bookedSlots" rows={occupancy.facilities} title="Okupansi ruang" /> : null}
          {tab === "equipment" ? <AnalyticsTable denominator="availableUnitSlots" numerator="usedUnitSlots" rows={equipment.facilityGroups} title="Utilisasi kelompok alat" /> : null}
          {tab === "damage" ? <section className="analytics-panel"><h2>Frekuensi laporan kerusakan</h2>{damage.byCategory.length ? <MiniBars rows={damage.byCategory.map((row) => ({ count: row.count, label: row.label }))} /> : <EmptyState description="Belum ada laporan pada periode ini." title="Tidak ada data laporan" />}</section> : null}
          {tab === "trends" ? <section className="analytics-panel"><h2>Tren okupansi harian</h2><MiniBars rows={trendRows} /><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Periode</th><th>Slot digunakan</th><th>Slot tersedia</th><th>Okupansi</th></tr></thead><tbody>{trends?.series.map((row) => <tr key={row.period}><td>{row.period}</td><td>{formatNumber(row.numerator)}</td><td>{formatNumber(row.denominator)}</td><td>{displayPercent(row.percentage)}</td></tr>)}</tbody></table></div></section> : null}
          {tab === "history" ? <section className="analytics-panel"><h2>Riwayat laporan fasilitas</h2>{history.items.length ? <><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Nomor</th><th>Fasilitas</th><th>Pelapor</th><th>Status</th><th>Dibuat</th></tr></thead><tbody>{history.items.map((item) => <tr key={item.id}><td>{item.reportNumber}</td><td>{item.facility.assetCode} · {item.facility.name}</td><td>{item.reporter?.name ?? "—"}</td><td><StatusBadge status={item.status} /></td><td>{formatJakartaDateTime(item.createdAt)}</td></tr>)}</tbody></table></div><Pagination onPageChange={setHistoryPage} page={history.page} total={history.total} totalPages={history.totalPages} /></> : <EmptyState description="Belum ada data pada filter yang dipilih." title="Belum ada riwayat laporan" />}</section> : null}
        </>}
      </section>
    </section>
  );
}

function AnalyticsTable({ denominator, numerator, rows, title }: { denominator: "availableSlots" | "availableUnitSlots"; numerator: "bookedSlots" | "usedUnitSlots"; rows: AnalyticsRow[]; title: string }) {
  const getMetric = (row: AnalyticsRow, metric: "availableSlots" | "availableUnitSlots" | "bookedSlots" | "usedUnitSlots") => row[metric] ?? 0;
  return <section className="analytics-panel"><h2>{title}</h2>{rows.length ? <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Fasilitas</th><th>Terpakai</th><th>Tersedia</th><th>Persentase</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.assetCode ?? ""}-${row.name}`}><td>{row.assetCode ? `${row.assetCode} · ` : ""}{row.name}</td><td>{formatNumber(getMetric(row, numerator))}</td><td>{formatNumber(getMetric(row, denominator))}</td><td>{displayPercent(row.percentage)}</td></tr>)}</tbody></table></div> : <EmptyState description="Tidak ada data pada filter yang dipilih." title="Belum ada data" />}</section>;
}
