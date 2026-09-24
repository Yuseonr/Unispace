"use client";

import type { SubmitEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
      if (user.role === "ADMIN") {
        router.replace("/admin");
      } else if (redirectTarget && redirectTarget.startsWith("/")) {
        router.replace(redirectTarget);
      } else {
        router.replace("/facilities");
      }
    } catch (caughtError) {
      const message = caughtError instanceof ApiError ? caughtError.message : "Masuk belum berhasil. Coba lagi beberapa saat.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
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
        <button className="button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Memeriksa akun…" : "Masuk"}
        </button>
      </form>

      {error ? (
        <p className="auth-form__feedback auth-form__feedback--error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="auth-panel__note">
        Belum punya akun? <Link href="/register">Daftar sekarang</Link>
      </p>
    </AuthShell>
  );
}
