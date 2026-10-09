"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  ErrorState,
  LoadingState,
  StatusBadge,
} from "@/components/ui/page-primitives";
import { useAuth, type AuthUser } from "@/features/auth/auth-provider";
import { readableApiError } from "@/lib/api/error-message";

type PasswordSession = { accessToken: string; user: AuthUser };

export function ProfilePage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, replaceSession, request, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasNewPassword = newPassword.length > 0;
  const passwordLengthIsValid =
    newPassword.length >= 12 && newPassword.length <= 24;
  const passwordHasNonWhitespace = /\S/.test(newPassword);
  const newPasswordIsValid = passwordLengthIsValid && passwordHasNonWhitespace;
  const newPasswordWarning = !hasNewPassword
    ? null
    : !passwordLengthIsValid
      ? newPassword.length < 12
        ? "Kurang dari 12 karakter"
        : "Maksimal 24 karakter"
      : !passwordHasNonWhitespace
        ? "Tidak boleh hanya spasi"
        : null;

  useEffect(() => {
    if (isReady && !user)
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [isReady, pathname, router, user]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword.length < 12 || newPassword.length > 24) {
      setError("Kata sandi baru harus terdiri dari 12–24 karakter.");
      return;
    }
    if (!/\S/.test(newPassword)) {
      setError("Kata sandi tidak boleh hanya berisi spasi.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("Konfirmasi kata sandi belum sama.");
      return;
    }
    setBusy(true);
    try {
      const session = await request<PasswordSession>("/auth/password", {
        body: { currentPassword, newPassword },
        method: "PATCH",
      });
      replaceSession(session);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setNotice(
        "Kata sandi berhasil diperbarui. Sesi Anda tetap aman dan aktif.",
      );
    } catch (reason) {
      setError(readableApiError(reason, "Kata sandi belum dapat diperbarui."));
    } finally {
      setBusy(false);
    }
  }

  if (!isReady)
    return (
      <main className="profile-page">
        <LoadingState label="Memeriksa sesi akun…" />
      </main>
    );
  if (!user)
    return (
      <main className="profile-page">
        <ErrorState error="Akun tidak ditemukan. Silakan masuk kembali." />
      </main>
    );

  return (
    <main className="profile-page">
      <nav
        aria-label="Breadcrumb"
        className="facility-breadcrumb profile-breadcrumb"
      >
        <Link href="/">Beranda</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Profil &amp; kata sandi</span>
      </nav>
      <section className="profile-card" aria-labelledby="profile-title">
        <header className="profile-identity">
          <span aria-hidden="true" className="profile-identity__avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1 id="profile-title">Profil Akun</h1>
          </div>
        </header>
        <h2 className="profile-section-title">Informasi akun</h2>
        <dl className="detail-grid profile-info-grid">
          <div>
            <dt>Nama</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>NIM / NIP</dt>
            <dd>{user.identityNumber}</dd>
          </div>
          <div>
            <dt>Peran dan status</dt>
            <dd>
              <StatusBadge
                status={user.role === "USER" ? "ACTIVE" : user.role}
                label={
                  user.role === "USER"
                    ? "Pengguna"
                    : user.role === "STAFF"
                      ? "Petugas"
                      : "Admin"
                }
              />{" "}
              <StatusBadge status={user.accountStatus} />
            </dd>
          </div>
        </dl>
        <form className="profile-form" onSubmit={submit}>
          <div className="profile-form__header">
            <h2>Ganti kata sandi</h2>
          </div>
          <div className="profile-form__grid">
            <label className="ui-form-field">
              <span>Kata sandi saat ini</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </label>
            <label
              className={`ui-form-field profile-password-field${hasNewPassword ? (newPasswordIsValid ? " is-valid" : " is-invalid") : ""}`}
            >
              <span className="profile-password-field__label">
                <span>Kata sandi baru</span>
                {newPasswordWarning ? (
                  <small
                    aria-live="polite"
                    className="profile-password-warning"
                    id="new-password-warning"
                  >
                    {newPasswordWarning}
                  </small>
                ) : null}
              </span>
              <input
                aria-describedby={
                  newPasswordWarning ? "new-password-warning" : undefined
                }
                aria-invalid={hasNewPassword && !newPasswordIsValid}
                autoComplete="new-password"
                maxLength={24}
                minLength={12}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label className="ui-form-field">
              <span>Konfirmasi kata sandi baru</span>
              <input
                autoComplete="new-password"
                maxLength={24}
                minLength={12}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </label>
          </div>
          {error ? (
            <p
              className="ui-form-feedback ui-form-feedback--error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="ui-form-feedback" role="status">
              {notice}
            </p>
          ) : null}
          <div className="profile-form__actions">
            <button
              className="admin-primary-button"
              disabled={busy}
              type="submit"
            >
              {busy ? "Menyimpan…" : "Simpan kata sandi"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
