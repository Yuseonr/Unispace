"use client";

import type { SubmitEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";

type PendingAccount = {
  accountStatus: "PENDING_VERIFICATION";
  createdAt: string;
  email: string;
  id: string;
  identityNumber: string;
  name: string;
  role: "USER";
};

type PendingAccountsResponse = {
  items: PendingAccount[];
  page: number;
  total: number;
  totalPages: number;
};

const avatarColors = ["#e3f3e7", "#e8f0ff", "#fff0df", "#f5eafb", "#e7f2f3"];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Data verifikasi belum dapat dimuat. Coba lagi.";
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

function rejectionReasonError(value: string) {
  const normalizedReason = value.trim().replace(/\s+/g, " ");
  if (!/\S/.test(normalizedReason)) return "Alasan penolakan wajib diisi.";
  if (normalizedReason.length > 1000) return "Alasan penolakan maksimal 1.000 karakter.";
  return undefined;
}

export function AccountVerification() {
  const { request } = useAuth();
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);
  const [rejectingAccount, setRejectingAccount] = useState<PendingAccount | null>(null);
  const [verifyingAccount, setVerifyingAccount] = useState<PendingAccount | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "10", page: String(page), status: "PENDING_VERIFICATION" });
    if (query.trim()) params.set("search", query.trim());

    try {
      const result = await request<PendingAccountsResponse>(`/admin/users?${params.toString()}`);
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
  }, [page, query, request]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadAccounts(), query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadAccounts, query]);

  function openRejectDialog(account: PendingAccount) {
    setRejectingAccount(account);
    setRejectReason("");
    setRejectReasonError(null);
  }

  function closeRejectDialog() {
    if (processingId) return;
    setRejectingAccount(null);
    setRejectReason("");
    setRejectReasonError(null);
  }

  async function verify(account: PendingAccount) {
    setProcessingId(account.id);
    setError(null);

    try {
      await request(`/admin/users/${account.id}/verify`, { method: "PATCH" });
      await loadAccounts();
      return true;
    } catch (nextError) {
      setError(errorMessage(nextError));
      return false;
    } finally {
      setProcessingId(null);
    }
  }

  async function reject(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectingAccount) return;

    const normalizedReason = rejectReason.trim().replace(/\s+/g, " ");
    const nextReasonError = rejectionReasonError(normalizedReason);
    setRejectReasonError(nextReasonError ?? null);
    if (nextReasonError) return;

    setProcessingId(rejectingAccount.id);
    setError(null);
    try {
      await request(`/admin/users/${rejectingAccount.id}/reject`, {
        body: { reason: normalizedReason },
        method: "PATCH",
      });
      setRejectingAccount(null);
      setRejectReason("");
      await loadAccounts();
    } catch (nextError) {
      setRejectReasonError(errorMessage(nextError));
    } finally {
      setProcessingId(null);
    }
  }

  const firstVisible = total === 0 ? 0 : (page - 1) * 10 + 1;
  const lastVisible = Math.min(page * 10, total);

  return (
    <main className="admin-page admin-users-page admin-verification-page">
      <header className="admin-users-header">
        <h1 className="sr-only">Verifikasi Akun</h1>
        <div className="admin-verification-count" aria-live="polite">Menunggu verifikasi <strong>({total.toLocaleString("id-ID")})</strong></div>
      </header>

      <section className="admin-users-surface" aria-label="Daftar akun menunggu verifikasi">
        <div className="admin-users-toolbar admin-verification-toolbar">
          <label className="admin-users-search">
            <SearchIcon />
            <input onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari nama, NIM, NIP, atau email..." type="search" value={query} />
          </label>
        </div>

        {error ? <p className="admin-users-error" role="alert">{error}</p> : null}

        <div className="admin-users-table-wrap">
          <table className="admin-users-table admin-verification-table">
            <thead><tr><th>Nama</th><th>NIM/NIP</th><th>Email</th><th>Peran</th><th>Tanggal daftar</th><th>Aksi</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td className="admin-users-table__message" colSpan={6}>Memuat pendaftaran…</td></tr> : null}
              {!isLoading && accounts.length === 0 ? <tr><td className="admin-users-table__message" colSpan={6}>Tidak ada akun yang menunggu verifikasi.</td></tr> : null}
              {!isLoading ? accounts.map((account, index) => (
                <tr key={account.id}>
                  <td><div className="admin-user-identity"><span aria-hidden="true" className="admin-user-avatar" style={{ backgroundColor: avatarColors[index % avatarColors.length] }}>{initials(account.name)}</span><strong>{account.name}</strong></div></td>
                  <td>{account.identityNumber}</td>
                  <td className="admin-users-table__email">{account.email}</td>
                  <td><span className="admin-role-pill admin-role-pill--user">User</span></td>
                  <td>{formatDate(account.createdAt)}</td>
                  <td>
                    <div className="admin-verification-actions">
                      <button className="admin-verify-button" disabled={processingId === account.id} onClick={() => setVerifyingAccount(account)} type="button">Terima</button>
                      <button className="admin-reject-button" disabled={processingId === account.id} onClick={() => openRejectDialog(account)} type="button">Tolak</button>
                    </div>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>

        <footer className="admin-users-pagination">
          <p>Menampilkan {firstVisible}–{lastVisible} dari {total.toLocaleString("id-ID")} pendaftaran</p>
          <div>
            <button aria-label="Halaman sebelumnya" disabled={page === 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">‹</button>
            <span>{page} / {totalPages}</span>
            <button aria-label="Halaman berikutnya" disabled={page === totalPages || isLoading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} type="button">›</button>
          </div>
        </footer>
      </section>

      {rejectingAccount ? <div aria-modal="true" className="admin-rejection-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRejectDialog(); }} role="dialog">
        <form aria-labelledby="reject-account-title" className="admin-rejection-dialog" onSubmit={reject}>
          <div>
            <p className="admin-eyebrow">Tolak pendaftaran</p>
            <h2 id="reject-account-title">Tolak akun {rejectingAccount.name}?</h2>
            <p>Alasan ini akan tersimpan dan dapat dilihat oleh calon pengguna.</p>
          </div>
          <label htmlFor="rejection-reason">Alasan penolakan</label>
          <textarea aria-describedby={rejectReasonError ? "rejection-reason-error" : undefined} aria-invalid={Boolean(rejectReasonError)} id="rejection-reason" maxLength={1000} onInput={(event) => { const value = event.currentTarget.value; setRejectReason(value); setRejectReasonError(rejectionReasonError(value) ?? null); }} placeholder="Contoh: NIM/NIP belum dapat diverifikasi." required value={rejectReason} />
          {rejectReasonError ? <p className="admin-rejection-dialog__error" id="rejection-reason-error">{rejectReasonError}</p> : null}
          <div className="admin-rejection-dialog__actions">
            <button disabled={Boolean(processingId)} onClick={closeRejectDialog} type="button">Batal</button>
            <button disabled={Boolean(processingId)} type="submit">{processingId ? "Menyimpan…" : "Tolak akun"}</button>
          </div>
        </form>
      </div> : null}
      <ConfirmDialog busy={processingId === verifyingAccount?.id} confirmLabel="Terima akun" isOpen={Boolean(verifyingAccount)} onClose={() => !processingId && setVerifyingAccount(null)} onConfirm={() => { if (verifyingAccount) void verify(verifyingAccount).then((success) => { if (success) setVerifyingAccount(null); }); }} title="Verifikasi akun pengguna">{verifyingAccount ? <p>Terima pendaftaran <strong>{verifyingAccount.name}</strong> ({verifyingAccount.identityNumber}) agar akun dapat masuk dan membuat reservasi?</p> : null}</ConfirmDialog>
    </main>
  );
}
