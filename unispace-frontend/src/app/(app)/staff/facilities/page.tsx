import { Suspense } from "react";

import { StaffFacilityCatalog } from "@/features/facilities/components/staff-facility-catalog";

export default function StaffFacilitiesPage() {
  return (
    <Suspense fallback={<main className="admin-loading">Memuat katalog…</main>}>
      <StaffFacilityCatalog />
    </Suspense>
  );
}
