import { Suspense } from "react";

import { AnalyticsPage } from "@/features/analytics/components/analytics-page";

export default function AdminAnalyticsPage() {
  return <Suspense fallback={<main className="admin-page">Memuat analytics…</main>}><AnalyticsPage /></Suspense>;
}
