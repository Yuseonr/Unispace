"use client";

import type { SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";

type ManagedUserField = "email" | "identityNumber" | "name";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Pengguna belum dapat dibuat. Coba lagi.";
}

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /></svg>;
}

export function CreateUserForm() {
  const { request } = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<Partial<Record<ManagedUserField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [role, setRole] = useState<"STAFF" | "USER">("USER");

  function getFieldError(field: ManagedUserField, value: string) {
    if (field === "name") {
      const normalizedName = value.trim().replace(/\s+/g, " ");
      return !/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(normalizedName) || normalizedName.length < 2 || normalizedName.length > 120
        ? "Nama harus 2–120 karakter dan hanya berisi huruf, spasi, apostrof, titik, atau tanda hubung."
        : undefined;
    }

    if (field === "identityNumber") {
      return !/^\d{8,30}$/.test(value.trim()) ? "NIM/NIP harus terdiri dari 8–30 digit." : undefined;
    }

    const normalizedEmail = value.trim();
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 320
      ? "Masukkan alamat email kampus yang valid."
      : undefined;
  }

  function validateField(field: ManagedUserField, value: string) {
    const fieldError = getFieldError(field, value);
    setErrors((current) => {
      if (!fieldError && !current[field]) return current;
      const next = { ...current };
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "").trim().replace(/\s+/g, " ");
    const identityNumber = String(values.get("identityNumber") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const nextErrors: Partial<Record<ManagedUserField, string>> = {};

    const nameError = getFieldError("name", name);
    const identityNumberError = getFieldError("identityNumber", identityNumber);
    const emailError = getFieldError("email", email);
    if (nameError) nextErrors.name = nameError;
    if (identityNumberError) nextErrors.identityNumber = identityNumberError;
    if (emailError) nextErrors.email = emailError;

    setErrors(nextErrors);
    setError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);

    try {
      await request("/admin/users", {
        body: {
          email,
          identityNumber,
          name,
          role,
        },
        method: "POST",
      });
      router.replace("/admin/accounts");
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="admin-page admin-create-user-page">
      <Link className="admin-back-link" href="/admin/accounts">← Kembali ke pengguna</Link>
      <section className="admin-create-user-card">
        <header>
          <h1>Tambah pengguna</h1>
          <p>Buat akun user atau petugas. Akun baru akan langsung aktif dengan kata sandi default sistem.</p>
        </header>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-create-user-field">
            <label htmlFor="managed-user-name">Nama lengkap</label>
            <input aria-describedby={errors.name ? "managed-user-name-error" : undefined} aria-invalid={Boolean(errors.name)} autoComplete="name" id="managed-user-name" maxLength={120} minLength={2} name="name" onInput={(event) => validateField("name", event.currentTarget.value)} placeholder="Contoh: Andi Pratama" required type="text" />
            {errors.name ? <p className="admin-create-user-field-error" id="managed-user-name-error">{errors.name}</p> : null}
          </div>
          <div className="admin-create-user-field">
            <label htmlFor="managed-user-identity-number">NIM/NIP</label>
            <input aria-describedby={errors.identityNumber ? "managed-user-identity-number-error" : undefined} aria-invalid={Boolean(errors.identityNumber)} autoComplete="off" id="managed-user-identity-number" inputMode="numeric" maxLength={30} minLength={8} name="identityNumber" onInput={(event) => validateField("identityNumber", event.currentTarget.value)} pattern="\d{8,30}" placeholder="Masukkan NIM atau NIP" required type="text" />
            {errors.identityNumber ? <p className="admin-create-user-field-error" id="managed-user-identity-number-error">{errors.identityNumber}</p> : null}
          </div>
          <div className="admin-create-user-field">
            <label htmlFor="managed-user-email">Email institusi</label>
            <input aria-describedby={errors.email ? "managed-user-email-error" : undefined} aria-invalid={Boolean(errors.email)} autoComplete="email" id="managed-user-email" maxLength={320} name="email" onInput={(event) => validateField("email", event.currentTarget.value)} placeholder="nama@students.undip.ac.id" required type="email" />
            {errors.email ? <p className="admin-create-user-field-error" id="managed-user-email-error">{errors.email}</p> : null}
          </div>
          <div className="admin-create-user-field">
            <span>Peran</span>
            <div className="admin-create-user-role">
              <button aria-expanded={isRoleOpen} aria-haspopup="menu" className="admin-create-user-role__trigger" onClick={() => setIsRoleOpen((open) => !open)} type="button">
                <span>{role === "USER" ? "User" : "Petugas"}</span>
                <ChevronIcon />
              </button>
              {isRoleOpen ? <div className="admin-create-user-role__menu" role="menu">
                <button aria-checked={role === "USER"} className={role === "USER" ? "is-selected" : ""} onClick={() => { setRole("USER"); setIsRoleOpen(false); }} role="menuitemradio" type="button">User</button>
                <button aria-checked={role === "STAFF"} className={role === "STAFF" ? "is-selected" : ""} onClick={() => { setRole("STAFF"); setIsRoleOpen(false); }} role="menuitemradio" type="button">Petugas</button>
              </div> : null}
            </div>
          </div>
          {error ? <p className="admin-create-user-error" role="alert">{error}</p> : null}
          <div className="admin-create-user-actions"><Link href="/admin/accounts">Batal</Link><button className="admin-primary-button" disabled={isSaving} type="submit">{isSaving ? "Menyimpan…" : "Simpan pengguna"}</button></div>
        </form>
      </section>
    </main>
  );
}
