"use client";
/* eslint-disable react-hooks/set-state-in-effect -- audit request state is populated asynchronously from the URL filters. */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from "@/components/ui/page-primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { readableApiError } from "@/lib/api/error-message";
import { formatJakartaDateTime } from "@/lib/format";

import { type AuditLogFilters, type AuditLogItem, type AuditLogResponse, listAuditLogs } from "../api";

const filterFields: Array<{ key: Exclude<keyof AuditLogFilters, "page">; label: string; placeholder: string; type?: "date" }> = [
  { key: "from", label: "Dari", type: "date", placeholder: "" },
  { key: "to", label: "Sampai", type: "date", placeholder: "" },
  { key: "actorId", label: "ID pelaku", placeholder: "UUID pelaku" },
  { key: "action", label: "Aksi", placeholder: "mis. REPORT_ACCEPTED" },
  { key: "entityType", label: "Entitas", placeholder: "mis. FACILITY_REPORT" },
  { key: "entityId", label: "ID entitas", placeholder: "UUID entitas" },
];

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function AuditLogPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, request, user } = useAuth();
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const filters = useMemo<AuditLogFilters>(() => ({
    action: searchParams.get("action") ?? undefined,
    actorId: searchParams.get("actorId") ?? undefined,
    entityId: searchParams.get("entityId") ?? undefined,
    entityType: searchParams.get("entityType") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    page: Math.max(1, Number(searchParams.get("page") ?? "1") || 1),
    to: searchParams.get("to") ?? undefined,
  }), [searchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await listAuditLogs(request, filters);
      setData(response);
      setError(null);
    } catch (reason) {
      setError(readableApiError(reason, "Audit log belum dapat dimuat."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && user?.role === "ADMIN") void load();
    // URL adalah source of truth untuk filter; load hanya berubah bersamanya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isReady, request, user?.role]);

  function updateFilter(key: keyof AuditLogFilters, value: string | number | undefined) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
    if (key !== "page") next.delete("page");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied("Browser tidak mengizinkan penyalinan.");
    }
  }

  if (!isReady || user?.role !== "ADMIN") {
    return <main className="admin-page"><LoadingState label="Memeriksa akses audit…" /></main>;
  }

  return (
    <section className="admin-page">
      <PageHeader eyebrow="Jejak aktivitas" title="Audit Log">
        <span>Riwayat bersifat read-only. Filter tersimpan di URL agar dapat dibagikan atau dibuka kembali.</span>
      </PageHeader>

      <section className="ui-surface">
        <div className="ui-toolbar audit-filter-bar">
          {filterFields.map((field) => (
            <label className="ui-field" key={field.key}>
              <span>{field.label}</span>
              <input
                onChange={(event) => updateFilter(field.key, event.target.value)}
                placeholder={field.placeholder}
                type={field.type ?? "text"}
                value={filters[field.key] ?? ""}
              />
            </label>
          ))}
        </div>

        {error ? <ErrorState error={error} onRetry={() => void load()} /> : null}
        {loading ? <LoadingState label="Memuat jejak aktivitas…" /> : null}
        {!loading && !error && data?.items.length === 0 ? <EmptyState description="Ubah atau bersihkan filter untuk melihat aktivitas lain." title="Tidak ada aktivitas" /> : null}
        {!loading && !error && data?.items.length ? (
          <>
            <div className="analytics-table-wrap">
              <table className="analytics-table audit-table">
                <thead><tr><th>Waktu WIB</th><th>Pelaku</th><th>Aksi</th><th>Entitas</th><th>Referensi</th><th /></tr></thead>
                <tbody>{data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatJakartaDateTime(item.createdAt)}</td>
                    <td>{item.actor ? <><strong>{item.actor.name}</strong><small>{item.actor.role}</small></> : "Sistem"}</td>
                    <td><code>{item.action}</code></td>
                    <td>{item.entityType}</td>
                    <td><button className="audit-id" onClick={() => void copy(item.entityId, "ID referensi disalin.")} type="button">{item.entityId}</button></td>
                    <td><button className="report-action-link" onClick={() => setSelected(item)} type="button">Detail</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <Pagination onPageChange={(page) => updateFilter("page", page)} page={data.page} total={data.total} totalPages={data.totalPages} />
          </>
        ) : null}
      </section>

      {selected ? <><button aria-label="Tutup detail audit" className="detail-drawer__backdrop" onClick={() => setSelected(null)} type="button" /><aside aria-label="Detail audit" aria-modal="true" className="detail-drawer" role="dialog"><header className="detail-drawer__header"><div><p className="ui-page-header__eyebrow">{selected.entityType}</p><h2>{selected.action}</h2></div><button onClick={() => setSelected(null)} type="button">Tutup</button></header><dl className="detail-grid"><div><dt>Waktu</dt><dd>{formatJakartaDateTime(selected.createdAt)}</dd></div><div><dt>Pelaku</dt><dd>{selected.actor ? `${selected.actor.name} · ${selected.actor.role}` : "Sistem"}</dd></div><div><dt>ID log</dt><dd><button className="audit-id" onClick={() => void copy(selected.id, "ID log disalin.")} type="button">{selected.id}</button></dd></div><div><dt>ID entitas</dt><dd><button className="audit-id" onClick={() => void copy(selected.entityId, "ID entitas disalin.")} type="button">{selected.entityId}</button></dd></div></dl><section className="audit-metadata"><h3>Metadata</h3>{selected.metadata && Object.keys(selected.metadata).length ? <dl>{Object.entries(selected.metadata).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{formatMetadataValue(value)}</dd></div>)}</dl> : <p>Tidak ada metadata tambahan yang aman untuk ditampilkan.</p>}</section>{copied ? <p className="ui-form-feedback" role="status">{copied}</p> : null}</aside></> : null}
    </section>
  );
}
