"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-provider";
import { fetchStaffReservations } from "@/features/reservations/api";

type SidebarItem = {
  badge?: string;
  href?: string;
  icon: "calendar" | "report" | "facility" | "profile";
  label: string;
};

function StaffSidebarIcon({ name }: { name: SidebarItem["icon"] }) {
  const paths = {
    calendar: (
      <>
        <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </>
    ),
    report: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" x2="12" y1="9" y2="13" />
        <line x1="12" x2="12.01" y1="17" y2="17" />
      </>
    ),
    facility: (
      <>
        <path d="M5 20V5h10v15M15 10h4v10M8 8h2M8 12h2M8 16h2M17 13h.1M17 16h.1M3 20h18" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="admin-navigation__icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

export function StaffShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, logout, request, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingReservationsCount, setPendingReservationsCount] = useState<number>(0);
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(0);

  useEffect(() => {
    if (isReady && user?.role !== "STAFF") {
      router.replace("/login");
    }
  }, [isReady, router, user?.role]);

  useEffect(() => {
    let isMounted = true;
    if (!isReady || user?.role !== "STAFF") return;

    fetchStaffReservations({ limit: 1, status: "PENDING" }, request)
      .then((res) => {
        if (!isMounted) return;
        setPendingReservationsCount(res.meta.total);
      })
      .catch(() => {
        // Abaikan error background fetch
      });

    request<{ meta?: { total?: number }; total?: number }>(
      "/staff/reports?status=PENDING&limit=1",
    )
      .then((res) => {
        if (!isMounted) return;
        setPendingReportsCount(res.meta?.total ?? res.total ?? 0);
      })
      .catch(() => {
        // Modul laporan belum diimplementasikan di backend branch ini
      });

    return () => {
      isMounted = false;
    };
  }, [isReady, pathname, request, user?.role]);

  if (!isReady || user?.role !== "STAFF") {
    return <main className="admin-loading">Memuat ruang kerja petugas…</main>;
  }

  const staffSidebarItems: SidebarItem[] = [
    {
      badge:
        pendingReservationsCount > 0
          ? pendingReservationsCount > 99
            ? "99+"
            : String(pendingReservationsCount)
          : undefined,
      href: "/staff/reservations",
      icon: "calendar",
      label: "Antrean Reservasi",
    },
    {
      badge:
        pendingReportsCount > 0
          ? pendingReportsCount > 99
            ? "99+"
            : String(pendingReportsCount)
          : undefined,
      href: "/staff/reports",
      icon: "report",
      label: "Laporan Kendala",
    },
    { href: "/staff/facilities", icon: "facility", label: "Fasilitas & Perbaikan" },
    { href: "/profile", icon: "profile", label: "Profil Akun" },
  ];

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await logout();
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/staff/reservations" aria-label="Unispace Petugas">
          <Image alt="Unispace" height={360} src="/Unispace_Logo_Trademark.svg" width={1450} priority />
          <span style={{ color: "#166534", fontWeight: 700, letterSpacing: "0.02em" }}>Portal Petugas</span>
        </Link>

        <nav className="admin-navigation" aria-label="Navigasi Petugas">
          {staffSidebarItems.map((item) => {
            const isActive = item.href ? pathname.startsWith(item.href) : false;
            const content = (
              <>
                <StaffSidebarIcon name={item.icon} />
                <span>{item.label}</span>
                {item.badge ? <em>{item.badge}</em> : null}
              </>
            );

            return item.href ? (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`admin-navigation__item${isActive ? " is-active" : ""}`}
                href={item.href}
                key={item.label}
              >
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
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "rgba(255,255,255,0.8)", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
            <div style={{ marginTop: "0.35rem", display: "inline-block", fontSize: "0.6875rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#dcfce7", color: "#15803d" }}>
              PETUGAS OPERASIONAL
            </div>
          </div>

          <button
            disabled={loggingOut}
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.6rem 0.85rem",
              borderRadius: "8px",
              background: "#ffffff",
              border: "1px solid #fca5a5",
              color: "#dc2626",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: loggingOut ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(220, 38, 38, 0.06)",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (!loggingOut) {
                e.currentTarget.style.background = "#fee2e2";
                e.currentTarget.style.borderColor = "#f87171";
                e.currentTarget.style.color = "#b91c1c";
              }
            }}
            onMouseLeave={(e) => {
              if (!loggingOut) {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#fca5a5";
                e.currentTarget.style.color = "#dc2626";
              }
            }}
            type="button"
          >
            <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            <span>{loggingOut ? "Mengeluarkan…" : "Keluar Akun"}</span>
          </button>
        </div>
      </aside>

      <main style={{ minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}
