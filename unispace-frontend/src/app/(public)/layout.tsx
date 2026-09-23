import type { ReactNode } from "react";

import { SiteHeader } from "./site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <SiteHeader />
      {children}
    </div>
  );
}
