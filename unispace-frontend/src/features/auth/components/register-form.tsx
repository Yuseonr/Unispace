"use client";

import type { SubmitEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";

type RegisterField = "name" | "identityNumber" | "email" | "password" | "passwordConfirmation";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [errors, setErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function getFieldError(field: RegisterField, value: string, password = "") {
    if (field === "name") {
      const normalizedName = value.trim().replace(/\s+/g, " ");
      return !/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(normalizedName) || normalizedName.length < 2 || normalizedName.length > 120
        ? "Nama harus 2–120 karakter dan hanya berisi huruf, spasi, apostrof, titik, atau tanda hubung."
        : undefined;
    }

    if (field === "identityNumber") {
      return !/^\d{8,30}$/.test(value.trim()) ? "NIM/NIP harus terdiri dari 8–30 digit." : undefined;
    }

    if (field === "email") {
      const normalizedEmail = value.trim();
      return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 320
        ? "Masukkan alamat email kampus yang valid."
        : undefined;
    }

    if (field === "password") {
      return value.length < 12 || value.length > 24 || !/\S/.test(value)
        ? "Kata sandi harus 12–24 karakter dan tidak boleh hanya berisi spasi."
        : undefined;
    }

    return value !== password ? "Konfirmasi kata sandi belum sama." : undefined;
  }

  function validateField(field: RegisterField, value: string, password = "") {
    const error = getFieldError(field, value, password);
    setErrors((current) => {
      if (!error && !current[field]) return current;
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
    const identityNumber = String(formData.get("identityNumber") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");
    const nextErrors: Partial<Record<RegisterField, string>> = {};

    const nameError = getFieldError("name", name);
    const identityNumberError = getFieldError("identityNumber", identityNumber);
    const emailError = getFieldError("email", email);
    const passwordError = getFieldError("password", password);
    const passwordConfirmationError = getFieldError(
      "passwordConfirmation",
      passwordConfirmation,
      password,
    );

    if (nameError) nextErrors.name = nameError;
    if (identityNumberError) nextErrors.identityNumber = identityNumberError;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (passwordConfirmationError) nextErrors.passwordConfirmation = passwordConfirmationError;

    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await register({ name, identityNumber, email, password });
      router.replace(`/account-status?status=${user.accountStatus}`);
    } catch (caughtError) {
      const message = caughtError instanceof ApiError
        ? caughtError.code === "ACCOUNT_ALREADY_EXISTS" ? "Akun ini sudah terdaftar" : caughtError.message
        : "Pendaftaran belum berhasil. Coba lagi beberapa saat.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell titleId="register-title" variant="register">
      <h2 className="auth-panel__title" id="register-title">
        Buat akun Unispace.
      </h2>
      <p className="auth-panel__intro">
        Isi data singkat di bawah untuk mulai melakukan reservasi dan pelaporan fasilitas kampus.
      </p>

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <label htmlFor="name">Nama lengkap</label>
        <input
          aria-describedby={errors.name ? "name-error" : undefined}
          aria-invalid={Boolean(errors.name)}
          autoComplete="name"
          id="name"
          maxLength={120}
          minLength={2}
          name="name"
          onInput={(event) => validateField("name", event.currentTarget.value)}
          placeholder="Nama kamu"
          required
          type="text"
        />
        {errors.name ? (
          <p className="auth-form__field-error" id="name-error">
            {errors.name}
          </p>
        ) : null}
        <label htmlFor="identity-number">NIM/NIP</label>
        <input
          aria-describedby={errors.identityNumber ? "identity-number-error" : undefined}
          aria-invalid={Boolean(errors.identityNumber)}
          autoComplete="off"
          id="identity-number"
          inputMode="numeric"
          maxLength={30}
          minLength={8}
          name="identityNumber"
          onInput={(event) => validateField("identityNumber", event.currentTarget.value)}
          pattern="\d{8,30}"
          placeholder="Contoh: 24060123123456"
          required
          type="text"
        />
        {errors.identityNumber ? (
          <p className="auth-form__field-error" id="identity-number-error">
            {errors.identityNumber}
          </p>
        ) : null}
        <label htmlFor="email">Email kampus</label>
        <input
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          id="email"
          maxLength={320}
          name="email"
          onInput={(event) => validateField("email", event.currentTarget.value)}
          placeholder="you@campus.ac.id"
          required
          type="email"
        />
        {errors.email ? (
          <p className="auth-form__field-error" id="email-error">
            {errors.email}
          </p>
        ) : null}
        <label htmlFor="password">Kata sandi</label>
        <input
          aria-describedby={errors.password ? "password-error" : undefined}
          aria-invalid={Boolean(errors.password)}
          autoComplete="new-password"
          id="password"
          maxLength={24}
          minLength={12}
          name="password"
          onInput={(event) => {
            validateField("password", event.currentTarget.value);
            const confirmation = event.currentTarget.form?.elements.namedItem("passwordConfirmation");

            if (confirmation instanceof HTMLInputElement) {
              validateField(
                "passwordConfirmation",
                confirmation.value,
                confirmation.value ? event.currentTarget.value : "",
              );
            }
          }}
          placeholder="12–24 karakter"
          required
          type="password"
        />
        {errors.password ? (
          <p className="auth-form__field-error" id="password-error">
            {errors.password}
          </p>
        ) : null}
        <label htmlFor="password-confirmation">Konfirmasi kata sandi</label>
        <input
          aria-describedby={errors.passwordConfirmation ? "password-confirmation-error" : undefined}
          aria-invalid={Boolean(errors.passwordConfirmation)}
          autoComplete="new-password"
          id="password-confirmation"
          maxLength={24}
          minLength={12}
          name="passwordConfirmation"
          onInput={(event) => {
            const password = event.currentTarget.form?.elements.namedItem("password");
            validateField(
              "passwordConfirmation",
              event.currentTarget.value,
              password instanceof HTMLInputElement ? password.value : "",
            );
          }}
          placeholder="Ulangi kata sandi"
          required
          type="password"
        />
        {errors.passwordConfirmation ? (
          <p className="auth-form__field-error" id="password-confirmation-error">
            {errors.passwordConfirmation}
          </p>
        ) : null}
        <button className="button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Mendaftarkan…" : "Buat akun"}
        </button>
      </form>

      {formError ? (
        <p className="auth-form__feedback auth-form__feedback--error" role="alert">
          {formError}
        </p>
      ) : null}

      <p className="auth-panel__note">
        Sudah punya akun? <Link href="/login">Masuk</Link>
      </p>
    </AuthShell>
  );
}
