import { Suspense } from "react";

import { UserReportList } from "@/features/facility-reports/components/user-report-list";

export default function ReportsPage() {
  return <Suspense><UserReportList /></Suspense>;
}
