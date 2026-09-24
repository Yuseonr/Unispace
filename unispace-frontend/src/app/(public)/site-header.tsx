"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, logout, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isHome = pathname === "/";
  const isFacilities = pathname.startsWith("/facilities");

  async function handleLogout() {
    setIsProfileOpen(false);
    await logout();
    router.replace("/");
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="Unispace, kembali ke beranda">
          <Image
            alt="Unispace"
            className="brand__logo"
            height={360}
            priority
            src="/Unispace_Logo_Trademark.svg"
            width={1450}
          />
        </Link>

        <nav className="site-nav" aria-label="Navigasi utama">
          <Link className={`site-nav__link${isHome ? " is-active" : ""}`} href="/" aria-current={isHome ? "page" : undefined}>
            Beranda
          </Link>
          <Link className={`site-nav__link${isFacilities ? " is-active" : ""}`} href="/facilities" aria-current={isFacilities ? "page" : undefined}>
            Katalog fasilitas
          </Link>
        </nav>

        <div className="header-actions">
          {isReady && user ? (
            <div className="header-profile">
              <button
                aria-expanded={isProfileOpen}
                aria-haspopup="menu"
                className="header-profile__trigger"
                onClick={() => setIsProfileOpen((open) => !open)}
                type="button"
              >
                <span className="header-profile__avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="header-profile__copy">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </span>
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
                </svg>
              </button>
              {isProfileOpen ? (
                <div className="header-profile__menu" role="menu">
                  <div className="header-profile__identity">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button onClick={() => void handleLogout()} role="menuitem" type="button">
                    Keluar
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Link className="header-link" href="/login">Masuk</Link>
              <Link className="header-button" href="/register">Daftar</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
