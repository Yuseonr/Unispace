"use client";

import type { SubmitEvent } from "react";
import { useState } from "react";
import Link from "next/link";

import { AuthShell } from "@/features/auth/components/auth-shell";

export default function LoginPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <AuthShell titleId="login-title" variant="login">
      <h2 className="auth-panel__title" id="login-title">
        Masuk ke Unispace.
      </h2>
      <p className="auth-panel__intro">
        Gunakan akun kampusmu untuk melanjutkan ke pengalaman Unispace.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">Email kampus</label>
        <input
          autoComplete="email"
          id="email"
          name="email"
          placeholder="you@campus.ac.id"
          required
          type="email"
        />
        <label htmlFor="password">Kata sandi</label>
        <input
          autoComplete="current-password"
          id="password"
          name="password"
          placeholder="Masukkan kata sandi"
          required
          type="password"
        />
        <button className="button-primary" type="submit">
          Masuk
        </button>
      </form>

      {submitted ? (
        <p className="auth-form__feedback" role="status">
          Form masuk siap dihubungkan ke layanan autentikasi.
        </p>
      ) : null}

      <p className="auth-panel__note">
        Belum punya akun? <Link href="/register">Daftar sekarang</Link>
      </p>
    </AuthShell>
  );
}
