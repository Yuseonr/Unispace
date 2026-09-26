import type { ReactNode } from "react";

type StatusTone = "active" | "attention" | "info" | "neutral" | "danger";

const statusMap: Record<string, { label: string; tone: StatusTone }> = {
  ACTIVE: { label: "Aktif", tone: "active" },
  APPROVED: { label: "Disetujui", tone: "active" },
  COMPLETED: { label: "Selesai", tone: "active" },
  IN_PROGRESS: { label: "Diproses", tone: "info" },
  MAINTENANCE: { label: "Dalam perbaikan", tone: "info" },
  NEW: { label: "Baru", tone: "attention" },
  PENDING: { label: "Menunggu", tone: "attention" },
  PENDING_VERIFICATION: { label: "Menunggu verifikasi", tone: "attention" },
  REJECTED: { label: "Ditolak", tone: "danger" },
  NONACTIVE: { label: "Nonaktif", tone: "neutral" },
  CANCELLED_BY_STAFF: { label: "Dibatalkan petugas", tone: "neutral" },
  CANCELLED_BY_SYSTEM: { label: "Dibatalkan sistem", tone: "neutral" },
  CANCELLED_BY_USER: { label: "Dibatalkan pengguna", tone: "neutral" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const config = statusMap[status] ?? { label: status.replaceAll("_", " "), tone: "neutral" as const };
  return <span className={`ui-status ui-status--${config.tone}`}><i aria-hidden="true" />{label ?? config.label}</span>;
}

export function PageHeader({
  action,
  eyebrow,
  title,
  children,
}: {
  action?: ReactNode;
  children?: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return <header className="ui-page-header"><div>{eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{children ? <p>{children}</p> : null}</div>{action ? <div className="ui-page-header__action">{action}</div> : null}</header>;
}

export function LoadingState({ label = "Memuat data…", compact = false }: { label?: string; compact?: boolean }) {
  return <div className={`ui-state ui-state--loading${compact ? " ui-state--compact" : ""}`} role="status"><span aria-hidden="true" className="slot-picker__spinner" />{label}</div>;
}

export function EmptyState({ action, description, title }: { action?: ReactNode; description: string; title: string }) {
  return <div className="ui-state ui-state--empty"><strong>{title}</strong><span>{description}</span>{action ? <div>{action}</div> : null}</div>;
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return <div className="ui-state ui-state--error" role="alert"><strong>Data belum dapat dimuat</strong><span>{error}</span>{onRetry ? <button className="admin-secondary-button" onClick={onRetry} type="button">Coba lagi</button> : null}</div>;
}

export function Pagination({
  onPageChange,
  page,
  totalPages,
  total,
}: {
  onPageChange: (page: number) => void;
  page: number;
  total: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return <p className="ui-pagination__summary">{total} hasil</p>;
  return <nav aria-label="Paginasi" className="ui-pagination"><span>Halaman {page} dari {totalPages} · {total} hasil</span><div><button aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">‹</button><button aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} type="button">›</button></div></nav>;
}
