"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { SiteHeader } from "@/app/(public)/site-header";
import { LoadingState } from "@/components/ui/page-primitives";
import { useAuth } from "@/features/auth/auth-provider";

export default function UserLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, user } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (user?.role === "USER") return;
    router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [isReady, pathname, router, user?.role]);

  if (!isReady || user?.role !== "USER") {
    return <main className="user-res-page"><LoadingState label="Memeriksa akses pengguna…" /></main>;
  }

  return (
    <div className="site-shell">
      <SiteHeader />
      {children}
    </div>
  );
}
