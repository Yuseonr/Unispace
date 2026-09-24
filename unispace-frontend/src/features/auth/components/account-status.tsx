"use client";

import Link from "next/link";

import { AuthShell } from "@/features/auth/components/auth-shell";

export function AccountStatus() {
  return (
    <AuthShell titleId="account-status-title" variant="login">
      <p className="auth-panel__eyebrow">Status akun</p>
      <h2 className="auth-panel__title" id="account-status-title">
        Pendaftaranmu sudah kami terima.
      </h2>
      <p className="auth-panel__intro">
        Admin akan memverifikasi data kampusmu. Kamu dapat masuk setelah akun berstatus aktif.
      </p>
      <Link className="button-primary auth-status__button" href="/login">
        Kembali ke masuk
      </Link>
    </AuthShell>
  );
}
