import { Suspense } from "react";

import { AuditLogPage } from "@/features/audit/components/audit-log-page";

export default function AuditLogsPage() {
  return <Suspense><AuditLogPage /></Suspense>;
}
