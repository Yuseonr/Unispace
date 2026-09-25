"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-provider";
import {
  approveStaffReservation,
  cancelStaffReservation,
  fetchStaffReservations,
  rejectStaffReservation,
  triggerAutoRejectExpired,
} from "@/features/reservations/api";
import { StaffApproveModal } from "@/features/reservations/components/staff-approve-modal";
import { StaffCancelModal } from "@/features/reservations/components/staff-cancel-modal";
import { StaffDetailModal } from "@/features/reservations/components/staff-detail-modal";
import { StaffRejectModal } from "@/features/reservations/components/staff-reject-modal";
import { StaffReservationTable } from "@/features/reservations/components/staff-reservation-table";
import type {
  ReservationStatus,
  StaffReservationItem,
  StaffReservationsPaginationMeta,
} from "@/features/reservations/types";
import { ApiError } from "@/lib/api/client";

type TabKey = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";

export default function StaffReservationsPage() {
  const router = useRouter();
  const { isReady, request, user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("PENDING");
  const [filterDate, setFilterDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [reservations, setReservations] = useState<StaffReservationItem[]>([]);
  const [meta, setMeta] = useState<StaffReservationsPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status feedback / Toast banner
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // State Modal Persetujuan
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [selectedForApprove, setSelectedForApprove] = useState<StaffReservationItem | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // State Modal Penolakan
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedForReject, setSelectedForReject] = useState<StaffReservationItem | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // State Modal Pembatalan Petugas
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [selectedForCancel, setSelectedForCancel] = useState<StaffReservationItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // State Modal Detail
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedForDetail, setSelectedForDetail] = useState<StaffReservationItem | null>(null);

  // Worker SLA Trigger State
  const [isTriggeringSla, setIsTriggeringSla] = useState(false);

  // Refresh trigger counter
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Role Guard
  useEffect(() => {
    if (!isReady) return;
    if (!user || user.role !== "STAFF") {
      router.replace("/login");
    }
  }, [isReady, router, user]);

  // Load Data
  useEffect(() => {
    let isMounted = true;
    if (!isReady || !user || user.role !== "STAFF") return;

    const statusParam: ReservationStatus | undefined =
      activeTab === "PENDING"
        ? "PENDING"
        : activeTab === "APPROVED"
          ? "APPROVED"
          : activeTab === "REJECTED"
            ? "REJECTED"
            : activeTab === "COMPLETED"
              ? "COMPLETED"
              : undefined;

    fetchStaffReservations(
      {
        limit: 20,
        page: currentPage,
        search: searchQuery.trim() || undefined,
        status: statusParam,
        usageDate: filterDate || undefined,
      },
      request,
    )
      .then((res) => {
        if (!isMounted) return;
        let data = res.data;
        // Jika tab CANCELLED, filter frontend untuk semua jenis varian cancel jika query backend belum mencakup multi-status
        if (activeTab === "CANCELLED") {
          data = data.filter((item) => item.status.startsWith("CANCELLED"));
        }
        setReservations(data);
        setMeta(res.meta);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : "Gagal memuat daftar antrean reservasi.";
        setError(msg);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, currentPage, filterDate, isReady, refreshTrigger, request, searchQuery, user]);

  function showFeedback(message: string, type: "success" | "error" = "success") {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  }

  // Handle Evaluasi SLA Expired Trigger
  async function handleTriggerSla() {
    try {
      setIsTriggeringSla(true);
      const res = await triggerAutoRejectExpired(request);
      showFeedback(
        `Evaluasi SLA berhasil: ${res.processedCount} permohonan kedaluwarsa telah ditolak otomatis.`,
        "success",
      );
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : "Gagal menjalankan evaluasi SLA.";
      showFeedback(msg, "error");
    } finally {
      setIsTriggeringSla(false);
    }
  }

  // Modal Action Handlers
  function openApproveModal(item: StaffReservationItem) {
    setSelectedForApprove(item);
    setApproveError(null);
    setIsApproveOpen(true);
  }

  async function handleConfirmApprove(allocatedAssetIds?: string[]) {
    if (!selectedForApprove) return;
    try {
      setIsApproving(true);
      setApproveError(null);
      await approveStaffReservation(
        selectedForApprove.id,
        { allocatedAssetIds },
        request,
      );
      setIsApproveOpen(false);
      setSelectedForApprove(null);
      showFeedback("Permohonan reservasi berhasil disetujui!", "success");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : "Gagal menyetujui reservasi.";
      setApproveError(msg);
    } finally {
      setIsApproving(false);
    }
  }

  function openRejectModal(item: StaffReservationItem) {
    setSelectedForReject(item);
    setRejectError(null);
    setIsRejectOpen(true);
  }

  async function handleConfirmReject(reason: string) {
    if (!selectedForReject) return;
    try {
      setIsRejecting(true);
      setRejectError(null);
      await rejectStaffReservation(selectedForReject.id, { reason }, request);
      setIsRejectOpen(false);
      setSelectedForReject(null);
      showFeedback("Permohonan reservasi berhasil ditolak.", "success");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : "Gagal menolak reservasi.";
      setRejectError(msg);
    } finally {
      setIsRejecting(false);
    }
  }

  function openCancelModal(item: StaffReservationItem) {
    setSelectedForCancel(item);
    setCancelError(null);
    setIsCancelOpen(true);
  }

  async function handleConfirmCancel(reason: string) {
    if (!selectedForCancel) return;
    try {
      setIsCancelling(true);
      setCancelError(null);
      await cancelStaffReservation(selectedForCancel.id, { reason }, request);
      setIsCancelOpen(false);
      setSelectedForCancel(null);
      showFeedback("Reservasi telah berhasil dibatalkan oleh petugas.", "success");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : "Gagal membatalkan reservasi.";
      setCancelError(msg);
    } finally {
      setIsCancelling(false);
    }
  }

  function openDetailModal(item: StaffReservationItem) {
    setSelectedForDetail(item);
    setIsDetailOpen(true);
  }

  // Hitung jumlah pending yang mendesak untuk badge tab
  const pendingCount = useMemo(() => {
    if (activeTab === "PENDING" && meta) return meta.total;
    return null;
  }, [activeTab, meta]);

  return (
    <div style={{ padding: "2rem", maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
      {/* Toast Feedback Banner */}
      {feedback ? (
        <div
          style={{
            position: "fixed",
            top: "1.5rem",
            right: "1.5rem",
            zIndex: 9999,
            padding: "0.85rem 1.25rem",
            borderRadius: "8px",
            background: feedback.type === "success" ? "#15803d" : "#dc2626",
            color: "#ffffff",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            fontSize: "0.875rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {feedback.type === "success" ? (
            <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="18">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {/* Header Utama Halaman */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            Antrean Reservasi Fasilitas
          </h1>
          <p style={{ color: "#64748b", margin: "0.35rem 0 0", fontSize: "0.9375rem" }}>
            Evaluasi kelayakan pengajuan peminjaman kampus dan tindaklanjuti sebelum batas waktu SLA terlampaui.
          </p>
        </div>

        <button
          disabled={isTriggeringSla}
          onClick={handleTriggerSla}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1rem",
            borderRadius: "8px",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            color: "#334155",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: isTriggeringSla ? "not-allowed" : "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
          type="button"
        >
          <svg
            className={isTriggeringSla ? "animate-spin" : ""}
            fill="none"
            height="16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="16"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>{isTriggeringSla ? "Mengevaluasi SLA…" : "Periksa SLA Expired"}</span>
        </button>
      </div>

      {/* Bilah Tab Status */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "0.5rem", marginBottom: "1.5rem", overflowX: "auto" }}>
        {[
          { key: "PENDING", label: "Menunggu" },
          { key: "APPROVED", label: "Disetujui" },
          { key: "ALL", label: "Semua Status" },
          { key: "REJECTED", label: "Ditolak" },
          { key: "CANCELLED", label: "Dibatalkan" },
          { key: "COMPLETED", label: "Selesai" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as TabKey);
                setCurrentPage(1);
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: "none",
                background: isActive ? "#15803d" : "transparent",
                color: isActive ? "#ffffff" : "#64748b",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
              type="button"
            >
              <span>{tab.label}</span>
              {tab.key === "PENDING" && pendingCount !== null ? (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: isActive ? "#ffffff" : "#fee2e2",
                    color: isActive ? "#15803d" : "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  {pendingCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Filter Tanggal & Pencarian */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem", background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <div style={{ flex: 1, minWidth: "240px" }}>
          <label htmlFor="search-input" style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>
            Pencarian
          </label>
          <input
            id="search-input"
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari pemohon, NIM, email, fasilitas, tujuan..."
            style={{
              width: "100%",
              padding: "0.55rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "0.875rem",
              background: "#ffffff",
            }}
            type="text"
            value={searchQuery}
          />
        </div>

        <div style={{ minWidth: "180px" }}>
          <label htmlFor="date-filter" style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>
            Tanggal Pemakaian
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="date-filter"
              onChange={(e) => {
                setFilterDate(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "0.55rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                background: "#ffffff",
              }}
              type="date"
              value={filterDate}
            />
            {filterDate ? (
              <button
                onClick={() => {
                  setFilterDate("");
                  setCurrentPage(1);
                }}
                style={{ padding: "0.55rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#64748b", cursor: "pointer", fontSize: "0.8125rem" }}
                title="Hapus filter tanggal"
                type="button"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Indikator Status & Hasil */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", fontSize: "0.875rem", color: "#64748b" }}>
        <span>
          Menampilkan <strong>{reservations.length}</strong> {meta ? `dari total ${meta.total}` : ""} permohonan
        </span>
        {loading ? <span>Memperbarui data antrean…</span> : null}
      </div>

      {/* Pesan Error Global */}
      {error ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "1rem", borderRadius: "8px", color: "#b91c1c", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            style={{ background: "#ffffff", border: "1px solid #fca5a5", color: "#b91c1c", padding: "0.35rem 0.75rem", borderRadius: "4px", fontSize: "0.8125rem", cursor: "pointer", fontWeight: 600 }}
            type="button"
          >
            Coba Lagi
          </button>
        </div>
      ) : null}

      {/* Tampilan Tabular Antrean Reservasi */}
      <StaffReservationTable
        isLoading={loading}
        onApprove={openApproveModal}
        onCancel={openCancelModal}
        onDetail={openDetailModal}
        onReject={openRejectModal}
        reservations={reservations}
      />

      {/* Paginasi Antrean */}
      {meta && meta.totalPages > 1 ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "2rem" }}>
          <button
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "0.875rem",
              cursor: currentPage <= 1 ? "not-allowed" : "pointer",
              opacity: currentPage <= 1 ? 0.5 : 1,
            }}
            type="button"
          >
            ← Sebelumnya
          </button>
          <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 600 }}>
            Halaman {currentPage} dari {meta.totalPages}
          </span>
          <button
            disabled={currentPage >= meta.totalPages || loading}
            onClick={() => setCurrentPage((p) => p + 1)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "0.875rem",
              cursor: currentPage >= meta.totalPages ? "not-allowed" : "pointer",
              opacity: currentPage >= meta.totalPages ? 0.5 : 1,
            }}
            type="button"
          >
            Selanjutnya →
          </button>
        </div>
      ) : null}

      {/* Dialog Modals */}
      <StaffApproveModal
        error={approveError}
        isOpen={isApproveOpen}
        isSubmitting={isApproving}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleConfirmApprove}
        reservation={selectedForApprove}
      />

      <StaffRejectModal
        error={rejectError}
        isOpen={isRejectOpen}
        isSubmitting={isRejecting}
        onClose={() => setIsRejectOpen(false)}
        onConfirm={handleConfirmReject}
        reservation={selectedForReject}
      />

      <StaffCancelModal
        error={cancelError}
        isOpen={isCancelOpen}
        isSubmitting={isCancelling}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        reservation={selectedForCancel}
      />

      <StaffDetailModal
        isOpen={isDetailOpen}
        onApprove={openApproveModal}
        onCancel={openCancelModal}
        onClose={() => setIsDetailOpen(false)}
        onReject={openRejectModal}
        reservation={selectedForDetail}
      />
    </div>
  );
}
