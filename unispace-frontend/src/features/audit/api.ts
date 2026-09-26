import type { AuthenticatedRequestFn } from "@/features/reservations/api";

export type AuditLogItem = {
  action: string;
  actor: { id: string; name: string; role: string } | null;
  createdAt: string;
  entityId: string;
  entityType: string;
  id: string;
  metadata: Record<string, unknown> | null;
};

export type AuditLogResponse = {
  items: AuditLogItem[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type AuditLogFilters = {
  action?: string;
  actorId?: string;
  entityId?: string;
  entityType?: string;
  from?: string;
  page?: number;
  to?: string;
};

export function listAuditLogs(request: AuthenticatedRequestFn, filters: AuditLogFilters) {
  const query = new URLSearchParams({ limit: "20", page: String(filters.page ?? 1) });

  (Object.entries(filters) as Array<[keyof AuditLogFilters, string | number | undefined]>).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && key !== "page") query.set(key, String(value));
  });

  return request<AuditLogResponse>(`/admin/audit-logs?${query.toString()}`);
}
