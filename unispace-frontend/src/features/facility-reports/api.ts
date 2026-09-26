import type { AuthenticatedRequestFn } from "@/features/reservations/api";

export type ReportStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
export type ReportCategory = "PHYSICAL_DAMAGE" | "ELECTRICAL_ELECTRONICS" | "CLEANLINESS" | "FURNITURE_EQUIPMENT" | "SECURITY" | "OTHER";
export type MaintenanceMode = "DATE_RANGE" | "TIME_RANGE";

export type ReportAttachment = { id: string; downloadUrl: string; originalFilename: string; mimeType: string; sizeBytes: number; createdAt: string };
export type MaintenancePeriod = { id: string; startAt: string; endAt: string; note: string | null };
export type ReportActor = { id: string; name: string; identityNumber?: string; email?: string };

export type FacilityReport = {
  id: string;
  reportNumber: string;
  category: ReportCategory;
  categoryLabel: string;
  description: string;
  status: ReportStatus;
  statusLabel: string;
  decisionReason: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  resolvedAt: string | null;
  reporter?: ReportActor;
  acceptedBy: ReportActor | null;
  resolvedBy: ReportActor | null;
  processedBy?: ReportActor | null;
  facility: { id: string; assetCode: string; name: string | null; status: string; facilityGroupId: string; facilityGroupName: string; reservationMode: "EXCLUSIVE" | "QUANTITY" };
  attachments: ReportAttachment[];
  maintenancePeriods: MaintenancePeriod[];
};

export type ReportList = { items: FacilityReport[]; page: number; limit: number; total: number; totalPages: number };
export type ReportAuditItem = { id: string; action: string; entityType: string; entityId: string; metadata: Record<string, unknown> | null; createdAt: string; actor: ReportActor | null };
export type ReportAuditList = { items: ReportAuditItem[]; page: number; limit: number; total: number; totalPages: number };
export type ReportableFacility = { facilityId: string; assetCode: string; name: string; status: "ACTIVE" | "MAINTENANCE"; locationDetail: string; facilityGroup: { id: string; name: string; reservationMode: "EXCLUSIVE" | "QUANTITY" }; facilityType: { id: string; name: string }; facilityArea: { id: string; code: string; name: string } };
export type ReportableFacilityList = { items: ReportableFacility[]; page: number; limit: number; total: number; totalPages: number };
export type MaintenanceImpactReservation = { id: string; usageDate: string; startTime: string; endTime: string; requestedQuantity: number };
export type MaintenancePreview = { facilityId: string; reportId: string; approvedReservations: MaintenanceImpactReservation[]; pendingReservations: MaintenanceImpactReservation[] };

export const REPORT_CATEGORIES: Array<{ value: ReportCategory; label: string }> = [
  { value: "PHYSICAL_DAMAGE", label: "Kerusakan fisik" }, { value: "ELECTRICAL_ELECTRONICS", label: "Listrik / elektronik" }, { value: "CLEANLINESS", label: "Kebersihan" }, { value: "FURNITURE_EQUIPMENT", label: "Furnitur / perlengkapan" }, { value: "SECURITY", label: "Keamanan" }, { value: "OTHER", label: "Lainnya" },
];

type QueryValue = string | number | undefined;
function queryString(input: Record<string, QueryValue>) {
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function listReportableFacilities(request: AuthenticatedRequestFn, input: { page?: number; limit?: number; search?: string } = {}) {
  return request<ReportableFacilityList>(`/reports/reportable-facilities${queryString(input)}`);
}

export function createReport(request: AuthenticatedRequestFn, form: FormData, idempotencyKey: string) {
  return request<FacilityReport>("/reports", { body: form, headers: { "Idempotency-Key": idempotencyKey }, method: "POST" });
}

export function listMyReports(request: AuthenticatedRequestFn, input: { createdFrom?: string; createdTo?: string; page?: number; status?: ReportStatus } = {}) {
  return request<ReportList>(`/reports/me${queryString({ limit: 12, ...input })}`);
}

export function getMyReport(request: AuthenticatedRequestFn, reportId: string) { return request<FacilityReport>(`/reports/me/${reportId}`); }

export function listStaffReports(request: AuthenticatedRequestFn, input: { createdFrom?: string; createdTo?: string; facilityId?: string; page?: number; search?: string; status?: ReportStatus } = {}) {
  return request<ReportList>(`/staff/reports${queryString({ limit: 20, ...input })}`);
}

export function getStaffReport(request: AuthenticatedRequestFn, reportId: string) { return request<FacilityReport>(`/staff/reports/${reportId}`); }
export function acceptStaffReport(request: AuthenticatedRequestFn, reportId: string) { return request<FacilityReport>(`/staff/reports/${reportId}/accept`, { method: "PATCH" }); }
export function rejectStaffReport(request: AuthenticatedRequestFn, reportId: string, reason: string) { return request<FacilityReport>(`/staff/reports/${reportId}/reject`, { body: { reason }, method: "PATCH" }); }
export function resolveStaffReport(request: AuthenticatedRequestFn, reportId: string, resolutionNote: string) { return request<FacilityReport>(`/staff/reports/${reportId}/resolve`, { body: { resolutionNote }, method: "PATCH" }); }
export function listReportAudit(request: AuthenticatedRequestFn, reportId: string) { return request<ReportAuditList>(`/staff/reports/${reportId}/audit?limit=50`); }

export type MaintenanceInput = { mode: MaintenanceMode; startDate?: string; endDate?: string; date?: string; startTime?: string; endTime?: string };
export function previewMaintenance(request: AuthenticatedRequestFn, reportId: string, input: MaintenanceInput) { return request<MaintenancePreview>(`/staff/reports/${reportId}/maintenance/preview`, { body: input, method: "POST" }); }
export function confirmMaintenance(request: AuthenticatedRequestFn, reportId: string, input: MaintenanceInput & { cancelImpactedReservations: true; cancellationReason: string; note?: string }, idempotencyKey: string) { return request<MaintenancePeriod>(`/staff/reports/${reportId}/maintenance`, { body: input, headers: { "Idempotency-Key": idempotencyKey }, method: "POST" }); }
export function endMaintenance(request: AuthenticatedRequestFn, periodId: string) { return request<MaintenancePeriod>(`/staff/reports/maintenance/${periodId}/end`, { method: "PATCH" }); }
