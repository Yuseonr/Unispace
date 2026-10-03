import { Suspense } from "react";
import { StaffMaintenance } from "@/features/facilities/components/staff-maintenance";

export default function StaffMaintenancePage() {
  return (
    <Suspense>
      <StaffMaintenance />
    </Suspense>
  );
}
