"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-provider";

type SidebarItem = {
  badge?: string;
  href?: string;
  icon: "dashboard" | "users" | "verify" | "facility" | "area" | "type" | "report" | "audit" | "settings";
  label: string;
};

const sidebarItems: SidebarItem[] = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/accounts", icon: "users", label: "Pengguna" },
  { href: "/admin/accounts/verification", icon: "verify", label: "Verifikasi Akun" },
  { href: "/admin/facilities/areas", icon: "area", label: "Area Kampus" },
  { href: "/admin/facilities/types", icon: "type", label: "Tipe Fasilitas" },
  { href: "/admin/facilities", icon: "facility", label: "Fasilitas" },
  { href: "/admin/analytics", icon: "report", label: "Rekap & Laporan" },
  { href: "/admin/audit-logs", icon: "audit", label: "Audit Log" },
];

function SidebarIcon({ name }: { name: SidebarItem["icon"] }) {
  const paths = {
    dashboard: <><rect height="6" rx="1" width="6" x="3.5" y="3.5" /><rect height="6" rx="1" width="6" x="14.5" y="3.5" /><rect height="6" rx="1" width="6" x="3.5" y="14.5" /><rect height="6" rx="1" width="6" x="14.5" y="14.5" /></>,
    users: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 20c.8-3.3 2.7-5 5.5-5s4.7 1.7 5.5 5M16.5 6.5a3 3 0 0 1 0 5M17 15.2c2 .3 3.2 1.9 3.8 4.8" /></>,
    verify: <><path d="M12 3.5 19 6v5.3c0 4.2-2.5 7.3-7 9.2-4.5-1.9-7-5-7-9.2V6zM8.7 11.8l2.1 2.1 4.5-4.5" /></>,
    facility: <><path d="M5 20V5h10v15M15 10h4v10M8 8h2M8 12h2M8 16h2M17 13h.1M17 16h.1M3 20h18" /></>,
    area: <><path d="M4 20h16M6 20V8l6-4 6 4v12M9 20v-5h6v5M9 10h.01M12 10h.01M15 10h.01" /></>,
    type: <><path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h5.2l7.3 7.3a2.1 2.1 0 0 1 0 3l-5.2 5.2a2.1 2.1 0 0 1-3 0L4.5 12.7z" /><circle cx="9" cy="8.5" r=".8" /></>,
    report: <><path d="M4 20h16M6.5 17v-5M12 17V7M17.5 17v-8" /><path d="m6 7.5 5-3 3 2 4-3" /></>,
    audit: <><path d="M8 4h8l1 2.2H20v14H4v-14h3zM8 10h8M8 14h5" /><circle cx="16.5" cy="16" r="2.5" /><path d="M16.5 14.7V16l1 1" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19 12 1.5-1 .1-2-1.8-.8-.8-1.8.8-1.8-1.4-1.4-1.8.8-1.8-.8L13 1.5h-2l-.8 1.8-1.8.8-1.8-.8L5.2 4.7 6 6.5 5.2 8.3 3.5 9v2l1.7.8.8 1.8-.8 1.8 1.4 1.4 1.8-.8 1.8.8.8 1.7h2l.8-1.7 1.8-.8 1.8.8 1.4-1.4-.8-1.8.8-1.8z" /></>,
  };

  return <svg aria-hidden="true" className="admin-navigation__icon" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, logout, request, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);

  useEffect(() => {
    if (isReady && user?.role !== "ADMIN") router.replace("/login");
  }, [isReady, router, user?.role]);

  useEffect(() => {
    let active = true;
    if (!isReady || user?.role !== "ADMIN") return;
    request<{ total: number }>("/admin/users?limit=1&status=PENDING_VERIFICATION")
      .then((response) => { if (active) setPendingVerificationCount(response.total); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isReady, pathname, request, user?.role]);

  if (!isReady || user?.role !== "ADMIN") {
    return <main className="admin-loading">Memuat ruang administrasi…</main>;
  }

  async function handleLogout() {
    setIsProfileOpen(false);
    await logout();
    router.replace("/login");
  }

  return (
    <main className="admin-app">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin" aria-label="Unispace Admin">
          <Image alt="Unispace" height={360} src="/Unispace_Logo_Trademark.svg" width={1450} />
          <span>Administrasi</span>
        </Link>

        <nav className="admin-navigation" aria-label="Navigasi admin">
          {sidebarItems.map((item) => {
            const badge = item.icon === "verify" && pendingVerificationCount > 0
              ? pendingVerificationCount > 99 ? "99+" : String(pendingVerificationCount)
              : item.badge;
            const isActive = item.href === "/admin"
              ? pathname === "/admin"
              : item.href === "/admin/accounts"
                ? pathname === "/admin/accounts" || pathname === "/admin/accounts/new"
                : item.href === "/admin/facilities"
                  ? pathname === "/admin/facilities" || pathname === "/admin/facilities/new" || (/^\/admin\/facilities\/[^/]+$/.test(pathname) && !["areas", "types"].includes(pathname.split("/").at(-1) ?? ""))
                  : item.href ? pathname.startsWith(item.href) : false;
            const content = <><SidebarIcon name={item.icon} /><span>{item.label}</span>{badge ? <em>{badge}</em> : null}</>;

            return item.href ? (
              <Link aria-current={isActive ? "page" : undefined} className={`admin-navigation__item${isActive ? " is-active" : ""}`} href={item.href} key={item.label}>
                {content}
              </Link>
            ) : (
              <button className="admin-navigation__item" key={item.label} type="button">
                {content}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar__bottom">
          <button className="admin-signout" onClick={handleLogout} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M13 4h3a2 2 0 0 1 2 2v14" />
              <path d="M2 20h3M13 20h9" />
              <path d="M13 2.5 5 5v15l8 1.5z" />
              <path d="M10 12v.01" />
            </svg>
            Keluar
          </button>
        </div>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar">
          <div className="admin-profile-menu">
            <button aria-expanded={isProfileOpen} className="admin-profile-trigger" onClick={() => setIsProfileOpen((open) => !open)} type="button">
              <span className="admin-profile-trigger__avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <span className="admin-profile-trigger__copy"><strong>{user.name}</strong><small>Super Admin</small></span>
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /></svg>
            </button>
            {isProfileOpen ? <div className="admin-profile-dropdown" role="menu">
              <p><strong>{user.name}</strong><span>{user.email}</span></p>
              <Link href="/profile" onClick={() => setIsProfileOpen(false)} role="menuitem">Profil & kata sandi</Link>
              <button onClick={() => void handleLogout()} role="menuitem" type="button">Keluar</button>
            </div> : null}
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
