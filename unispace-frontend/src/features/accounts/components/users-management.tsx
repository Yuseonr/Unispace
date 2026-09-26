"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";

type ManagedRole = "USER" | "STAFF";
type ManagedStatus = "PENDING_VERIFICATION" | "ACTIVE" | "REJECTED" | "NONACTIVE";
type RoleFilter = "ALL" | ManagedRole;
type CreatedAtSort = "newest" | "oldest";

type ManagedAccount = {
  accountStatus: ManagedStatus;
  createdAt: string;
  email: string;
  id: string;
  identityNumber: string;
  name: string;
  role: ManagedRole;
};

type ManagedAccountsResponse = {
  items: ManagedAccount[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

type AccountCounts = Record<RoleFilter, number>;

type OpenAction = {
  account: ManagedAccount;
  left: number;
  top: number;
};

type PendingConfirmation =
  | { account: ManagedAccount; kind: "reset" }
  | { account: ManagedAccount; kind: "status"; nextStatus: "ACTIVE" | "NONACTIVE" };

const initialCounts: AccountCounts = { ALL: 0, STAFF: 0, USER: 0 };

const roleTabs: Array<{ label: string; value: RoleFilter }> = [
  { label: "Semua", value: "ALL" },
  { label: "User", value: "USER" },
  { label: "Petugas", value: "STAFF" },
];

const roleLabel: Record<ManagedRole, string> = {
  STAFF: "Petugas",
  USER: "User",
};

const statusLabel: Record<ManagedStatus, string> = {
  ACTIVE: "Aktif",
  NONACTIVE: "Nonaktif",
  PENDING_VERIFICATION: "Menunggu",
  REJECTED: "Ditolak",
};

const avatarColors = ["#e3f3e7", "#e8f0ff", "#fff0df", "#f5eafb", "#e7f2f3"];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Data pengguna belum dapat dimuat. Coba lagi.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.4 15.4 4.1 4.1" /></svg>;
}

function MoreIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.1" /><circle cx="12" cy="12" r="1.1" /><circle cx="12" cy="19" r="1.1" /></svg>;
}

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /></svg>;
}

export function UsersManagement() {
  const { request } = useAuth();
  const [activeRole, setActiveRole] = useState<RoleFilter>("ALL");
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [counts, setCounts] = useState<AccountCounts>(initialCounts);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<OpenAction | null>(null);
  const [openDropdown, setOpenDropdown] = useState<"sort" | "status" | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CreatedAtSort>("newest");
  const [status, setStatus] = useState<"ALL" | ManagedStatus>("ALL");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCounts = useCallback(async (): Promise<AccountCounts> => {
    const [all, users, staff] = await Promise.all([
      request<ManagedAccountsResponse>("/admin/users?limit=1"),
      request<ManagedAccountsResponse>("/admin/users?limit=1&role=USER"),
      request<ManagedAccountsResponse>("/admin/users?limit=1&role=STAFF"),
    ]);
    return { ALL: all.total, STAFF: staff.total, USER: users.total };
  }, [request]);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "10", page: String(page) });
    if (activeRole !== "ALL") params.set("role", activeRole);
    if (status !== "ALL") params.set("status", status);
    if (query.trim()) params.set("search", query.trim());

    try {
      const result = await request<ManagedAccountsResponse>(`/admin/users?${params.toString()}`);
      setAccounts(result.items);
      setTotal(result.total);
      setTotalPages(Math.max(result.totalPages, 1));
    } catch (nextError) {
      setAccounts([]);
      setTotal(0);
      setTotalPages(1);
      setError(errorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  }, [activeRole, page, query, request, status]);

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialCounts() {
      try {
        const nextCounts = await fetchCounts();
        if (isCurrent) setCounts(nextCounts);
      } catch {
        // The table still exposes the primary request error if this supporting count fails.
      }
    }

    void loadInitialCounts();
    return () => { isCurrent = false; };
  }, [fetchCounts]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadAccounts(), query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadAccounts, query]);

  function changeRole(role: RoleFilter) {
    setActiveRole(role);
    setPage(1);
    setOpenAction(null);
    setOpenDropdown(null);
  }

  function changeStatus(nextStatus: "ALL" | ManagedStatus) {
    setStatus(nextStatus);
    setPage(1);
    setOpenAction(null);
    setOpenDropdown(null);
  }

  function changeSort(nextSort: CreatedAtSort) {
    setSort(nextSort);
    setOpenDropdown(null);
  }

  function toggleActionMenu(event: MouseEvent<HTMLButtonElement>, account: ManagedAccount) {
    const trigger = event.currentTarget.getBoundingClientRect();
    if (openAction?.account.id === account.id) {
      setOpenAction(null);
      return;
    }

    const width = 172;
    setOpenAction({
      account,
      left: Math.max(12, trigger.right - width),
      top: trigger.bottom + 6,
    });
  }

  function updateAccountStatus(account: ManagedAccount) {
    if (account.accountStatus !== "ACTIVE" && account.accountStatus !== "NONACTIVE") return;
    const nextStatus = account.accountStatus === "ACTIVE" ? "NONACTIVE" : "ACTIVE";
    setPendingConfirmation({ account, kind: "status", nextStatus });
    setOpenAction(null);
  }

  async function confirmAction() {
    if (!pendingConfirmation) return;
    setIsConfirming(true);
    try {
      if (pendingConfirmation.kind === "status") {
        await request(`/admin/users/${pendingConfirmation.account.id}/status`, { body: { status: pendingConfirmation.nextStatus }, method: "PATCH" });
        const nextCounts = await fetchCounts();
        setCounts(nextCounts);
        await loadAccounts();
        setNotice(`Akses ${pendingConfirmation.account.name} ${pendingConfirmation.nextStatus === "NONACTIVE" ? "dinonaktifkan" : "diaktifkan kembali"}.`);
      } else {
        await request(`/admin/users/${pendingConfirmation.account.id}/reset-password`, { method: "POST" });
        setNotice(`Kata sandi ${pendingConfirmation.account.name} berhasil direset.`);
      }
      setPendingConfirmation(null);
    } catch (nextError) {
      setNotice(errorMessage(nextError));
    } finally {
      setIsConfirming(false);
    }
  }

  function resetPassword(account: ManagedAccount) {
    setPendingConfirmation({ account, kind: "reset" });
    setOpenAction(null);
  }

  const firstVisible = total === 0 ? 0 : (page - 1) * 10 + 1;
  const lastVisible = Math.min(page * 10, total);
  const visibleAccounts = sort === "newest"
    ? accounts
    : [...accounts].sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());

  return (
    <main className="admin-page admin-users-page">
      <header className="admin-users-header">
        <h1 className="sr-only">Pengguna</h1>
        <nav aria-label="Filter peran pengguna" className="admin-role-tabs">
          {roleTabs.map((tab) => (
            <button className={activeRole === tab.value ? "is-active" : ""} key={tab.value} onClick={() => changeRole(tab.value)} type="button">
              {tab.label}
              <span>({counts[tab.value].toLocaleString("id-ID")})</span>
            </button>
          ))}
        </nav>
        <Link className="admin-primary-button" href="/admin/accounts/new">
          <span aria-hidden="true">+</span>
          Tambah Pengguna
        </Link>
      </header>

      <section className="admin-users-surface" aria-label="Daftar pengguna">
        <div className="admin-users-toolbar">
          <label className="admin-users-search">
            <SearchIcon />
            <input onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari nama, NIM, NIP, atau email..." type="search" value={query} />
          </label>

          <div className="admin-filter-dropdown">
            <button aria-expanded={openDropdown === "status"} aria-haspopup="menu" className="admin-filter-trigger" onClick={() => setOpenDropdown((current) => current === "status" ? null : "status")} type="button">
              <span>{status === "ALL" ? "Semua status" : statusLabel[status]}</span>
              <ChevronIcon />
            </button>
            {openDropdown === "status" ? <div className="admin-filter-dropdown__menu" role="menu">
              <button aria-checked={status === "ALL"} className={status === "ALL" ? "is-selected" : ""} onClick={() => changeStatus("ALL")} role="menuitemradio" type="button">Semua status</button>
              <button aria-checked={status === "ACTIVE"} className={status === "ACTIVE" ? "is-selected" : ""} onClick={() => changeStatus("ACTIVE")} role="menuitemradio" type="button">Aktif</button>
              <button aria-checked={status === "PENDING_VERIFICATION"} className={status === "PENDING_VERIFICATION" ? "is-selected" : ""} onClick={() => changeStatus("PENDING_VERIFICATION")} role="menuitemradio" type="button">Menunggu</button>
              <button aria-checked={status === "NONACTIVE"} className={status === "NONACTIVE" ? "is-selected" : ""} onClick={() => changeStatus("NONACTIVE")} role="menuitemradio" type="button">Nonaktif</button>
              <button aria-checked={status === "REJECTED"} className={status === "REJECTED" ? "is-selected" : ""} onClick={() => changeStatus("REJECTED")} role="menuitemradio" type="button">Ditolak</button>
            </div> : null}
          </div>

          <div className="admin-filter-dropdown">
            <button aria-expanded={openDropdown === "sort"} aria-haspopup="menu" className="admin-filter-trigger" onClick={() => setOpenDropdown((current) => current === "sort" ? null : "sort")} type="button">
              <span>{sort === "newest" ? "Urutkan: Terbaru" : "Urutkan: Terlama"}</span>
              <ChevronIcon />
            </button>
            {openDropdown === "sort" ? <div className="admin-filter-dropdown__menu" role="menu">
              <button aria-checked={sort === "newest"} className={sort === "newest" ? "is-selected" : ""} onClick={() => changeSort("newest")} role="menuitemradio" type="button">Terbaru</button>
              <button aria-checked={sort === "oldest"} className={sort === "oldest" ? "is-selected" : ""} onClick={() => changeSort("oldest")} role="menuitemradio" type="button">Terlama</button>
            </div> : null}
          </div>
        </div>

        {notice ? <p className="admin-users-notice" role="status">{notice}</p> : null}
        {error ? <p className="admin-users-error" role="alert">{error}</p> : null}

        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead><tr><th>Nama</th><th>NIM/NIP</th><th>Email</th><th>Peran</th><th>Status</th><th>Tanggal daftar</th><th>Aksi</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td className="admin-users-table__message" colSpan={7}>Memuat pengguna…</td></tr> : null}
              {!isLoading && accounts.length === 0 ? <tr><td className="admin-users-table__message" colSpan={7}>Belum ada pengguna yang sesuai dengan filter ini.</td></tr> : null}
              {!isLoading ? visibleAccounts.map((account, index) => (
                <tr key={account.id}>
                  <td>
                    <div className="admin-user-identity">
                      <span aria-hidden="true" className="admin-user-avatar" style={{ backgroundColor: avatarColors[index % avatarColors.length] }}>{initials(account.name)}</span>
                      <strong>{account.name}</strong>
                    </div>
                  </td>
                  <td>{account.identityNumber}</td>
                  <td className="admin-users-table__email">{account.email}</td>
                  <td><span className={`admin-role-pill admin-role-pill--${account.role.toLowerCase()}`}>{roleLabel[account.role]}</span></td>
                  <td><span className={`admin-status-pill admin-status-pill--${account.accountStatus.toLowerCase()}`}>{statusLabel[account.accountStatus]}</span></td>
                  <td>{formatDate(account.createdAt)}</td>
                  <td className="admin-users-table__action">
                    <div className="admin-row-actions">
                      <button aria-expanded={openAction?.account.id === account.id} aria-label={`Aksi untuk ${account.name}`} className="admin-more-button" onClick={(event) => toggleActionMenu(event, account)} type="button"><MoreIcon /></button>
                    </div>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>

        <footer className="admin-users-pagination">
          <p>Menampilkan {firstVisible}–{lastVisible} dari {total.toLocaleString("id-ID")} pengguna</p>
          <div>
            <button aria-label="Halaman sebelumnya" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">‹</button>
            <span>{page} / {totalPages}</span>
            <button aria-label="Halaman berikutnya" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} type="button">›</button>
          </div>
        </footer>
      </section>

      {openAction ? createPortal(
        <div className="admin-action-menu admin-action-menu--floating" role="menu" style={{ left: openAction.left, top: openAction.top }}>
          <button className={openAction.account.accountStatus === "NONACTIVE" ? "is-activate" : ""} disabled={openAction.account.accountStatus !== "ACTIVE" && openAction.account.accountStatus !== "NONACTIVE"} onClick={() => updateAccountStatus(openAction.account)} role="menuitem" type="button">{openAction.account.accountStatus === "NONACTIVE" ? "Aktifkan" : "Nonaktifkan"}</button>
          <button disabled={openAction.account.accountStatus !== "ACTIVE" && openAction.account.accountStatus !== "NONACTIVE"} onClick={() => resetPassword(openAction.account)} role="menuitem" type="button">Reset kata sandi</button>
        </div>,
        document.body,
      ) : null}
      <ConfirmDialog busy={isConfirming} confirmLabel={pendingConfirmation?.kind === "reset" ? "Reset kata sandi" : pendingConfirmation?.nextStatus === "NONACTIVE" ? "Nonaktifkan akses" : "Aktifkan akses"} destructive={pendingConfirmation?.kind === "reset" || pendingConfirmation?.nextStatus === "NONACTIVE"} isOpen={Boolean(pendingConfirmation)} onClose={() => !isConfirming && setPendingConfirmation(null)} onConfirm={() => void confirmAction()} title={pendingConfirmation?.kind === "reset" ? "Reset kata sandi akun" : pendingConfirmation?.nextStatus === "NONACTIVE" ? "Nonaktifkan akses akun" : "Aktifkan akses akun"}>{pendingConfirmation?.kind === "reset" ? <p>Kata sandi <strong>{pendingConfirmation.account.name}</strong> akan dikembalikan ke password awal administrasi. Sampaikan password tersebut melalui kanal yang aman.</p> : pendingConfirmation ? <p>{pendingConfirmation.nextStatus === "NONACTIVE" ? <>Akses <strong>{pendingConfirmation.account.name}</strong> akan dinonaktifkan. Sistem juga akan menolak reservasi pending dan membatalkan reservasi mendatang yang sudah disetujui sesuai aturan backend.</> : <>Aktifkan kembali akses <strong>{pendingConfirmation.account.name}</strong>?</>}</p> : null}</ConfirmDialog>
    </main>
  );
}
