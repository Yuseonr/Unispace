import { Suspense } from "react";

import { FacilityCatalog } from "@/features/facilities/components/facility-catalog";

export default function FacilitiesPage() {
  return <Suspense fallback={<main className="landing catalog-page">Memuat katalog…</main>}><FacilityCatalog /></Suspense>;
}
