"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { cancelMyReservation, fetchMyReservations } from "@/features/reservations/api";
import { CancelReservationModal } from "@/features/reservations/components/cancel-reservation-modal";
import { ReservationCard } from "@/features/reservations/components/reservation-card";
import type {
  MyReservationsPaginationMeta,
  ReservationStatus,
  UserReservationItem,
} from "@/features/reservations/types";
import { ApiError } from "@/lib/api/client";

type TabKey = "ALL" | "PENDING" | "APPROVED" | "HISTORY";

const HISTORY_STATUSES: ReservationStatus[] = [
  "COMPLETED",
  "REJECTED",
  "CANCELLED_BY_USER",
  "CANCELLED_BY_STAFF",
  "CANCELLED_BY_SYSTEM",
];

export default function UserReservationsPage() {
  const router = useRouter();
  const { isReady, request, user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [reservations, setReservations] = useState<UserReservationItem[]>([]);
  const [meta, setMeta] = useState<MyReservationsPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status notifikasi feedback aksi
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // State Modal Pembatalan Mandiri
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedForCancel, setSelectedForCancel] = useState<UserReservationItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Proteksi rute: Arahkan ke login jika belum terautentikasi
  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent("/reservations")}`);
    }
  }, [isReady, router, user]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    setLoading(true);
  }

  function handleDateChange(date: string) {
    setFilterDate(date);
    setLoading(true);
  }

  function handleRetry() {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }

  useEffect(() => {
    let isMounted = true;

    if (!isReady || !user) return;

    const queryStatus: ReservationStatus | undefined =
      activeTab === "PENDING"
        ? "PENDING"
        : activeTab === "APPROVED"
          ? "APPROVED"
          : undefined;

    fetchMyReservations(
      {
        limit: 50,
        status: queryStatus,
        usageDate: filterDate || undefined,
      },
      request,
    )
      .then((response) => {
        if (!isMounted) return;
        setReservations(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Gagal memuat daftar reservasi.");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, filterDate, isReady, refreshTrigger, request, user]);

  // Filter daftar sesuai tab aktif
  const displayedReservations = useMemo(() => {
    if (activeTab === "HISTORY") {
      return reservations.filter((r) => HISTORY_STATUSES.includes(r.status));
    }
    return reservations;
  }, [activeTab, reservations]);

  // Hitung jumlah item PENDING untuk badge tab
  const pendingCount = useMemo(() => {
    return reservations.filter((r) => r.status === "PENDING").length;
  }, [reservations]);

  function handleOpenCancelModal(res: UserReservationItem) {
    setSelectedForCancel(res);
    setCancelError(null);
    setIsCancelModalOpen(true);
  }

  function handleCloseCancelModal() {
    if (isCancelling) return;
    setIsCancelModalOpen(false);
    setSelectedForCancel(null);
    setCancelError(null);
  }

  async function handleConfirmCancel() {
    if (!selectedForCancel) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      const updated = await cancelMyReservation(selectedForCancel.id, request);

      // Perbarui state lokal secara reaktif
      setReservations((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );

      setIsCancelModalOpen(false);
      setSelectedForCancel(null);
      setFeedbackMessage("Reservasi berhasil dibatalkan.");

      setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);
    } catch (err) {
      if (err instanceof ApiError) {
        setCancelError(err.message);
      } else if (err instanceof Error) {
        setCancelError(err.message);
      } else {
        setCancelError("Gagal membatalkan reservasi. Silakan coba kembali.");
      }
    } finally {
      setIsCancelling(false);
    }
  }

  if (!isReady || !user) {
    return (
      <main className="user-res-page">
        <div className="user-res-loading" role="status">
          <span className="slot-picker__spinner" aria-hidden="true" />
          <span>Memeriksa sesi pengguna…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="user-res-page">
      {/* Header Halaman */}
      <div className="user-res-header">
        <div className="user-res-header__text">
          <nav aria-label="Breadcrumb" className="facility-breadcrumb user-res-breadcrumb">
            <Link href="/">Beranda</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Reservasi Saya</span>
          </nav>
          <h1 className="user-res-title">Reservasi Saya</h1>
          <p className="user-res-subtitle">
            Pantau status verifikasi, jadwal pemakaian fasilitas, serta kelola permohonan reservasi Anda.
          </p>
        </div>

        <div className="user-res-header__actions">
          <Link className="button-primary user-res-new-btn" href="/facilities">
            + Pesan Fasilitas Baru
          </Link>
        </div>
      </div>

      {/* Pesan Feedback Sukses */}
      {feedbackMessage ? (
        <div className="user-res-feedback-banner" role="status">
          <span className="user-res-feedback-banner__icon" aria-hidden="true">✓</span>
          <span>{feedbackMessage}</span>
          <button
            aria-label="Tutup pesan"
            className="user-res-feedback-banner__close"
            onClick={() => setFeedbackMessage(null)}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Navigasi Tab Status & Filter */}
      <div className="user-res-controls">
        <div aria-label="Filter status reservasi" className="user-res-tabs" role="tablist">
          <button
            aria-selected={activeTab === "ALL"}
            className={`user-res-tab ${activeTab === "ALL" ? "is-active" : ""}`}
            onClick={() => handleTabChange("ALL")}
            role="tab"
            type="button"
          >
            Semua
          </button>

          <button
            aria-selected={activeTab === "PENDING"}
            className={`user-res-tab ${activeTab === "PENDING" ? "is-active" : ""}`}
            onClick={() => handleTabChange("PENDING")}
            role="tab"
            type="button"
          >
            <span>Menunggu</span>
            {pendingCount > 0 ? (
              <span className="user-res-tab__badge">{pendingCount}</span>
            ) : null}
          </button>

          <button
            aria-selected={activeTab === "APPROVED"}
            className={`user-res-tab ${activeTab === "APPROVED" ? "is-active" : ""}`}
            onClick={() => handleTabChange("APPROVED")}
            role="tab"
            type="button"
          >
            Disetujui
          </button>

          <button
            aria-selected={activeTab === "HISTORY"}
            className={`user-res-tab ${activeTab === "HISTORY" ? "is-active" : ""}`}
            onClick={() => handleTabChange("HISTORY")}
            role="tab"
            type="button"
          >
            Riwayat Selesai & Batal
          </button>
        </div>

        {/* Filter Tanggal Pemakaian */}
        <div className="user-res-date-filter">
          <label className="user-res-date-filter__label" htmlFor="res-filter-date">
            Cari Tanggal:
          </label>
          <input
            className="user-res-date-filter__input"
            id="res-filter-date"
            onChange={(e) => handleDateChange(e.target.value)}
            type="date"
            value={filterDate}
          />
          {filterDate ? (
            <button
              className="user-res-date-filter__reset"
              onClick={() => handleDateChange("")}
              title="Hapus filter tanggal"
              type="button"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {/* Daftar Konten Reservasi */}
      {loading ? (
        <div className="user-res-loading-list" role="status">
          <span className="slot-picker__spinner" aria-hidden="true" />
          <span>Memuat daftar reservasi Anda…</span>
        </div>
      ) : error ? (
        <div className="user-res-error-state" role="alert">
          <p>{error}</p>
          <button
            className="button-primary"
            onClick={handleRetry}
            type="button"
          >
            Coba Lagi
          </button>
        </div>
      ) : displayedReservations.length === 0 ? (
        <div className="user-res-empty-state">
          <div className="user-res-empty-state__icon" aria-hidden="true">
            <svg fill="none" height="48" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="48">
              <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <h2 className="user-res-empty-state__title">Belum Ada Reservasi</h2>
          <p className="user-res-empty-state__desc">
            {filterDate
              ? "Tidak ada permohonan reservasi pada tanggal yang Anda pilih."
              : activeTab === "PENDING"
                ? "Tidak ada permohonan yang sedang menunggu verifikasi petugas saat ini."
                : activeTab === "APPROVED"
                  ? "Belum ada jadwal fasilitas yang disetujui."
                  : "Anda belum memiliki riwayat reservasi fasilitas atau alat kampus."}
          </p>
          <Link className="button-primary user-res-empty-state__btn" href="/facilities">
            Jelajahi Katalog Fasilitas
          </Link>
        </div>
      ) : (
        <div className="user-res-list">
          <div className="user-res-list__meta">
            <span>
              Menampilkan <strong>{displayedReservations.length}</strong> reservasi
              {meta ? ` dari total ${meta.total}` : ""}
            </span>
          </div>

          <div className="user-res-grid">
            {displayedReservations.map((item) => (
              <ReservationCard
                key={item.id}
                onCancelClick={handleOpenCancelModal}
                reservation={item}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal Pembatalan Mandiri */}
      <CancelReservationModal
        error={cancelError}
        isOpen={isCancelModalOpen}
        isSubmitting={isCancelling}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancel}
        reservation={selectedForCancel}
      />
    </main>
  );
}
