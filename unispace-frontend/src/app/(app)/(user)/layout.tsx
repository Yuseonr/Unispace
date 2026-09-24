import type { ReactNode } from "react";

import { SiteHeader } from "@/app/(public)/site-header";

export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <SiteHeader />
      {children}
    </div>
  );
}
