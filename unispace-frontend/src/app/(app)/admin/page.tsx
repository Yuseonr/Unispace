import { Suspense } from "react";

import { AnalyticsPage } from "@/features/analytics/components/analytics-page";

export default function AdminPage() {
  return <Suspense fallback={<main className="admin-page">Memuat dashboard…</main>}><AnalyticsPage compact /></Suspense>;
}
