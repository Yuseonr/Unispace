"use client";
/* eslint-disable react-hooks/set-state-in-effect -- maintenance rows are populated asynchronously from URL-driven filters. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui/page-primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import { readableApiError } from "@/lib/api/error-message";
import { formatJakartaDateTime } from "@/lib/format";

import {
  endMaintenance,
  type StaffMaintenanceResponse,
  listStaffMaintenance,
} from "../data/staff-maintenance-api";

export function StaffMaintenance() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, request, user } = useAuth();
  const [data, setData] = useState<StaffMaintenanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogPeriodId, setDialogPeriodId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const stateParam = searchParams.get("state");
  const state: "ALL" | "ACTIVE" | "SCHEDULED" =
    stateParam === "ACTIVE" || stateParam === "SCHEDULED" ? stateParam : "ALL";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const load = async () => {
    setLoading(true);
    try {
      setData(await listStaffMaintenance(request, { page, state }));
      setError(null);
    } catch (reason) {
      setError(
        readableApiError(reason, "Daftar perbaikan belum dapat dimuat."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && user?.role === "STAFF") void load();
    // Filter URL dan sesi menentukan data operasional saat ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, page, request, state, user?.role]);

  function updateQuery(nextState: string, nextPage = 1) {
    const query = new URLSearchParams(searchParams.toString());
    if (nextState === "ALL") query.delete("state");
    else query.set("state", nextState);
    if (nextPage === 1) query.delete("page");
    else query.set("page", String(nextPage));
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  async function endMaintenanceEarly() {
    if (!dialogPeriodId) return;
    setEnding(true);
    setDialogError(null);
    try {
      await endMaintenance(request, dialogPeriodId);
      setDialogPeriodId(null);
      await load();
    } catch (reason) {
      setDialogError(
        readableApiError(reason, "Perbaikan belum dapat diakhiri."),
      );
    } finally {
      setEnding(false);
    }
  }

  if (!isReady || user?.role !== "STAFF")
    return (
      <main className="admin-page">
        <LoadingState label="Memeriksa akses fasilitas…" />
      </main>
    );

  return (
    <section className="admin-page">
      <PageHeader
        action={
          <Link className="admin-secondary-button" href="/staff/reports">
            Buka antrean laporan
          </Link>
        }
        eyebrow="Operasional"
        title="Jadwal Perbaikan"
      >
        Pantau periode maintenance yang sedang aktif atau sudah dijadwalkan.
        Halaman ini tidak mengubah master fasilitas.
      </PageHeader>
      <section className="ui-surface">
        <div
          aria-label="Filter periode perbaikan"
          className="report-status-tabs"
        >
          {["ALL", "ACTIVE", "SCHEDULED"].map((option) => (
            <button
              className={state === option ? "is-active" : ""}
              key={option}
              onClick={() => updateQuery(option)}
              type="button"
            >
              {option === "ALL"
                ? "Semua"
                : option === "ACTIVE"
                  ? "Aktif sekarang"
                  : "Terjadwal"}
            </button>
          ))}
        </div>
        {loading ? (
          <LoadingState label="Memuat periode perbaikan…" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void load()} />
        ) : !data?.items.length ? (
          <EmptyState
            description="Tidak ada fasilitas dalam perbaikan untuk filter ini."
            title="Tidak ada periode perbaikan"
          />
        ) : (
          <>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Fasilitas / aset</th>
                    <th>Area</th>
                    <th>Jadwal</th>
                    <th>Status</th>
                    <th>Laporan asal</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((period) => (
                    <tr key={period.id}>
                      <td>
                        <strong>{period.facility.assetCode}</strong>
                        <br />
                        <small>
                          {period.facility.name ??
                            period.facility.facilityGroup.name}
                        </small>
                      </td>
                      <td>{period.facility.facilityGroup.facilityArea.name}</td>
                      <td>
                        {formatJakartaDateTime(period.startAt)}
                        <br />
                        <small>
                          s.d. {formatJakartaDateTime(period.endAt)}
                        </small>
                      </td>
                      <td>
                        <StatusBadge
                          label={
                            period.state === "ACTIVE"
                              ? "Dalam perbaikan"
                              : "Terjadwal"
                          }
                          status={
                            period.state === "ACTIVE"
                              ? "IN_PROGRESS"
                              : "PENDING"
                          }
                        />
                      </td>
                      <td>
                        {period.report ? (
                          <>
                            <Link
                              className="report-action-link"
                              href={`/staff/reports?reportId=${period.report.id}`}
                            >
                              {period.report.reportNumber}
                            </Link>
                            <br />
                            <small>{period.report.categoryLabel}</small>
                          </>
                        ) : (
                          <span className="ui-secondary-text">
                            Perbaikan Mandiri
                          </span>
                        )}
                      </td>
                      <td>
                        {period.state === "ACTIVE" ? (
                          <button
                            className="report-action-link"
                            onClick={() => {
                              setDialogError(null);
                              setDialogPeriodId(period.id);
                            }}
                            type="button"
                          >
                            Akhiri sekarang
                          </button>
                        ) : (
                          <span className="ui-secondary-text">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              onPageChange={(nextPage) => updateQuery(state, nextPage)}
              page={data.page}
              total={data.total}
              totalPages={data.totalPages}
            />
          </>
        )}
      </section>
      <ConfirmDialog
        busy={ending}
        confirmLabel="Akhiri perbaikan"
        destructive
        error={dialogError}
        isOpen={Boolean(dialogPeriodId)}
        onClose={() => {
          if (!ending) {
            setDialogPeriodId(null);
            setDialogError(null);
          }
        }}
        onConfirm={() => void endMaintenanceEarly()}
        title="Akhiri perbaikan lebih awal?"
      >
        <p>
          Waktu selesai akan disimpan sebagai waktu aktual. Slot mulai dan
          jadwal maintenance biasa tetap mengikuti aturan 30 menit.
        </p>
      </ConfirmDialog>
    </section>
  );
}
