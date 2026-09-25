"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-provider";
import {
  approveStaffReservation,
  cancelStaffReservation,
  formatDateOnlyIndonesian,
  formatSlotTime,
  getReservationStatusConfig,
  getSlaUrgencyStatus,
  getStaffReservationDetail,
  rejectStaffReservation,
} from "@/features/reservations/api";
import { StaffApproveModal } from "@/features/reservations/components/staff-approve-modal";
import { StaffCancelModal } from "@/features/reservations/components/staff-cancel-modal";
import { StaffRejectModal } from "@/features/reservations/components/staff-reject-modal";
import type { StaffReservationItem } from "@/features/reservations/types";
import { ApiError } from "@/lib/api/client";

export default function StaffReservationDetailPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const resolvedParams = use(params);
  const reservationId = resolvedParams.reservationId;

  const router = useRouter();
  const { isReady, request, user } = useAuth();

  const [reservation, setReservation] = useState<StaffReservationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modals state
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Role Guard
  useEffect(() => {
    if (!isReady) return;
    if (!user || user.role !== "STAFF") {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  // Load Detail
  useEffect(() => {
    let isMounted = true;
    if (!isReady || !user || user.role !== "STAFF" || !reservationId) return;

    getStaffReservationDetail(reservationId, request)
      .then((data) => {
        if (!isMounted) return;
        setReservation(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : "Gagal memuat rincian permohonan reservasi.";
        setError(msg);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isReady, refreshTrigger, request, reservationId, user]);

  async function handleConfirmApprove(allocatedAssetIds?: string[]) {
    if (!reservation) return;
    try {
      setIsApproving(true);
      setApproveError(null);
      await approveStaffReservation(reservation.id, { allocatedAssetIds }, request);
      setIsApproveOpen(false);
      setFeedback("Permohonan reservasi berhasil disetujui!");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Gagal menyetujui reservasi.";
      setApproveError(msg);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleConfirmReject(reason: string) {
    if (!reservation) return;
    try {
      setIsRejecting(true);
      setRejectError(null);
      await rejectStaffReservation(reservation.id, { reason }, request);
      setIsRejectOpen(false);
      setFeedback("Permohonan reservasi berhasil ditolak.");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Gagal menolak reservasi.";
      setRejectError(msg);
    } finally {
      setIsRejecting(false);
    }
  }

  async function handleConfirmCancel(reason: string) {
    if (!reservation) return;
    try {
      setIsCancelling(true);
      setCancelError(null);
      await cancelStaffReservation(reservation.id, { reason }, request);
      setIsCancelOpen(false);
      setFeedback("Reservasi berhasil dibatalkan oleh petugas.");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Gagal membatalkan reservasi.";
      setCancelError(msg);
    } finally {
      setIsCancelling(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "3rem 2rem", maxWidth: "800px", margin: "0 auto", textAlign: "center", color: "#64748b" }}>
        Memuat rincian permohonan reservasi…
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div style={{ padding: "3rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "1.5rem", borderRadius: "10px", color: "#b91c1c" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Terjadi Kesalahan</h2>
          <p style={{ margin: "0 0 1rem" }}>{error ?? "Data reservasi tidak ditemukan."}</p>
          <Link
            href="/staff/reservations"
            style={{ display: "inline-block", padding: "0.5rem 1rem", background: "#ffffff", border: "1px solid #fca5a5", color: "#b91c1c", borderRadius: "6px", fontWeight: 600, textDecoration: "none" }}
          >
            ← Kembali ke Antrean
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getReservationStatusConfig(reservation.status);
  const targetName = reservation.facility?.name ?? reservation.facilityGroup?.name ?? "Fasilitas Kampus";
  const isExclusive = Boolean(reservation.facilityId);
  const areaName = reservation.facility?.facilityGroup?.facilityArea?.name ?? reservation.facilityGroup?.facilityArea?.name;
  const locationDetail = reservation.facility?.facilityGroup?.locationDetail ?? reservation.facilityGroup?.locationDetail;
  const dateFormatted = formatDateOnlyIndonesian(reservation.usageDate.split("T")[0] ?? "");
  const timeRange = `${formatSlotTime(reservation.startTime)} – ${formatSlotTime(reservation.endTime)} WIB`;
  const sla = getSlaUrgencyStatus(reservation.decisionDeadline);
  const allocatedAssets = reservation.allocatedAssets ?? [];

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
      {/* Tombol Navigasi Kembali */}
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href="/staff/reservations"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "#64748b", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600 }}
        >
          ← Kembali ke Antrean Reservasi
        </Link>
      </div>

      {/* Banner Feedback */}
      {feedback ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem 1rem", borderRadius: "8px", color: "#166534", marginBottom: "1.5rem", fontWeight: 600, fontSize: "0.875rem" }}>
          {feedback}
        </div>
      ) : null}

      {/* Kartu Utama Rincian */}
      <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "2rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {/* Header Rincian */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", paddingBottom: "1.5rem", borderBottom: "1px solid #e2e8f0" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: isExclusive ? "#e0e7ff" : "#fef3c7", color: isExclusive ? "#3730a3" : "#92400e" }}>
                {isExclusive ? "Ruang Eksklusif" : `Kelompok Alat (${reservation.requestedQuantity} Unit)`}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>ID: {reservation.id}</span>
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {targetName}
            </h1>
            <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
              {areaName ?? "-"} {locationDetail ? `· ${locationDetail}` : ""}
            </p>
          </div>

          <span className={`user-res-badge ${statusConfig.badgeClass}`}>
            <span className="user-res-badge__dot" aria-hidden="true" />
            <span>{statusConfig.label}</span>
          </span>
        </div>

        {/* Bagian Identitas Pemohon */}
        <div style={{ padding: "1.5rem 0", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 0.85rem", letterSpacing: "0.05em" }}>
            Informasi Pemohon
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", background: "#f8fafc", padding: "1rem", borderRadius: "8px" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Nama Lengkap</span>
              <strong style={{ color: "#0f172a", fontSize: "0.9375rem" }}>{reservation.user.name}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>NIM / NIP</span>
              <span style={{ color: "#1e293b", fontSize: "0.9375rem" }}>{reservation.user.identityNumber}</span>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Email</span>
              <span style={{ color: "#1e293b", fontSize: "0.9375rem" }}>{reservation.user.email}</span>
            </div>
          </div>
        </div>

        {/* Bagian Jadwal & Penggunaan */}
        <div style={{ padding: "1.5rem 0", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 0.85rem", letterSpacing: "0.05em" }}>
            Jadwal Pemakaian
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Tanggal Penggunaan</span>
              <strong style={{ color: "#0f172a", fontSize: "0.9375rem" }}>{dateFormatted}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Rentang Waktu</span>
              <span style={{ color: "#1e293b", fontSize: "0.9375rem" }}>{timeRange}</span>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Diajukan Pada</span>
              <span style={{ color: "#1e293b", fontSize: "0.875rem" }}>{new Date(reservation.createdAt).toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>

        {/* Bagian Tujuan Kegiatan */}
        <div style={{ padding: "1.5rem 0", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 0.5rem", letterSpacing: "0.05em" }}>
            Tujuan Peminjaman
          </h2>
          <p style={{ margin: 0, color: "#334155", fontSize: "0.9375rem", lineHeight: 1.6, background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            {reservation.purpose}
          </p>
        </div>

        {/* Bagian Batas SLA & Audit */}
        <div style={{ padding: "1.5rem 0", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", margin: "0 0 0.85rem", letterSpacing: "0.05em" }}>
            Tenggat Keputusan & Catatan Audit
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "8px" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Batas Waktu Keputusan Petugas (SLA)</span>
                <strong>{reservation.decisionDeadline ? new Date(reservation.decisionDeadline).toLocaleString("id-ID") : "-"}</strong>
              </div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: sla.urgencyLevel === "danger" || sla.urgencyLevel === "expired" ? "#dc2626" : "#15803d" }}>
                {sla.remainingText}
              </span>
            </div>

            {reservation.decidedAt ? (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span style={{ color: "#64748b" }}>Waktu Keputusan:</span>
                <span>{new Date(reservation.decidedAt).toLocaleString("id-ID")}</span>
              </div>
            ) : null}

            {reservation.processedBy ? (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span style={{ color: "#64748b" }}>Petugas Pemroses:</span>
                <span>{reservation.processedBy.name} ({reservation.processedBy.email})</span>
              </div>
            ) : null}

            {allocatedAssets.length > 0 ? (
              <div style={{ marginTop: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#166534", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>Unit Fisik Teralokasi:</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {allocatedAssets.map((asset) => (
                    <span key={asset.id} style={{ background: "#ffffff", border: "1px solid #86efac", color: "#15803d", padding: "3px 8px", borderRadius: "4px", fontWeight: 700, fontSize: "0.8125rem" }}>
                      {asset.assetCode ?? asset.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {reservation.decisionReason ? (
              <div style={{ background: "#fef2f2", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #fee2e2", color: "#991b1b", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                <strong>Catatan Alasan: </strong>
                {reservation.decisionReason}
              </div>
            ) : null}
          </div>
        </div>

        {/* Tombol Aksi Petugas */}
        <div style={{ paddingTop: "1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
          {reservation.status === "PENDING" ? (
            <>
              <button
                onClick={() => {
                  setRejectError(null);
                  setIsRejectOpen(true);
                }}
                style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "1px solid #fca5a5", background: "#ffffff", color: "#dc2626", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
                type="button"
              >
                Tolak Permohonan
              </button>
              <button
                onClick={() => {
                  setApproveError(null);
                  setIsApproveOpen(true);
                }}
                style={{ padding: "0.6rem 1.5rem", borderRadius: "8px", border: "none", background: "#16a34a", color: "#ffffff", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
                type="button"
              >
                Setujui Permohonan
              </button>
            </>
          ) : null}

          {reservation.status === "APPROVED" ? (
            <button
              onClick={() => {
                setCancelError(null);
                setIsCancelOpen(true);
              }}
              style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: "1px solid #fecdd3", background: "#fff1f2", color: "#e11d48", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
              type="button"
            >
              Batalkan Reservasi Ini
            </button>
          ) : null}
        </div>
      </div>

      {/* Modals */}
      <StaffApproveModal
        error={approveError}
        isOpen={isApproveOpen}
        isSubmitting={isApproving}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleConfirmApprove}
        reservation={reservation}
      />

      <StaffRejectModal
        error={rejectError}
        isOpen={isRejectOpen}
        isSubmitting={isRejecting}
        onClose={() => setIsRejectOpen(false)}
        onConfirm={handleConfirmReject}
        reservation={reservation}
      />

      <StaffCancelModal
        error={cancelError}
        isOpen={isCancelOpen}
        isSubmitting={isCancelling}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        reservation={reservation}
      />
    </div>
  );
}
