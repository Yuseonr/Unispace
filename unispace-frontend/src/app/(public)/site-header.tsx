"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isFacilities = pathname.startsWith("/facilities");

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
          <Link className="header-link" href="/login">Masuk</Link>
          <Link className="header-button" href="/register">Daftar</Link>
        </div>
      </div>
    </header>
  );
}
