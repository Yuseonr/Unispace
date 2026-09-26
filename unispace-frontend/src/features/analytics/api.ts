import type { AuthenticatedRequestFn } from "@/features/reservations/api";

export type AnalyticsFilters = {
  dateFrom: string;
  dateTo: string;
  facilityAreaId?: string;
  facilityGroupId?: string;
  facilityId?: string;
  facilityTypeId?: string;
  reservationMode?: "EXCLUSIVE" | "QUANTITY";
};

export type AnalyticsSummary = {
  filters: AnalyticsFilters;
  generatedAt: string;
  reservations: { total: number; approvedOrCompleted: number; totalUsedHours: number; byStatus: Record<string, number>; decisionTimeHours: { average: number | null; median: number | null } };
  reports: { total: number; qualifyingDamageReports: number; byStatus: Record<string, number>; resolutionTimeHours: { average: number | null; median: number | null } };
  facilities: { totalUnits: number; currentNonactiveUnits: number; historicalNonactiveUnits: number };
};

export type AnalyticsRow = { percentage: number | null; bookedSlots?: number; availableSlots?: number; usedUnitSlots?: number; availableUnitSlots?: number; name: string; assetCode?: string; facilityGroupName?: string; facilityArea?: { name: string }; facilityType?: { name: string } };
export type OccupancyAnalytics = { percentage: number | null; bookedSlots: number; availableSlots: number; facilities: AnalyticsRow[] };
export type EquipmentAnalytics = { percentage: number | null; usedUnitSlots: number; availableUnitSlots: number; facilityGroups: AnalyticsRow[] };
export type DamageAnalytics = { total: number; byCategory: Array<{ key: string; count: number; label: string }>; byStatus: Array<{ key: string; count: number }>; byFacility: Array<{ key: string; count: number; facilityId: string; assetCode: string; name: string }> };
export type TrendAnalytics = { metric: string; interval: string; series: Array<{ period: string; numerator?: number; denominator?: number; percentage?: number; count?: number }> };
export type ReportHistoryItem = { id: string; reportNumber: string; categoryLabel: string; status: string; facility: { assetCode: string; name: string; facilityArea: { name: string }; facilityType: { name: string } }; reporter: { name: string } | null; createdAt: string; resolutionHours: number | null };
export type ReportHistory = { items: ReportHistoryItem[]; page: number; total: number; totalPages: number };

function queryString(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function getAnalytics<T>(request: AuthenticatedRequestFn, resource: "summary" | "occupancy" | "equipment-utilization" | "damage-frequency" | "trends" | "facility-report-history", input: AnalyticsFilters & Record<string, string | number | undefined>) {
  return request<T>(`/admin/analytics/${resource}${queryString(input)}`);
}

export function exportAnalytics(request: AuthenticatedRequestFn, input: AnalyticsFilters & { format: "csv" | "xlsx" | "pdf"; interval?: "day" | "month"; metric?: "occupancy" | "equipment-utilization" | "damage-frequency"; orientation?: "portrait" | "landscape"; report: "summary" | "occupancy" | "equipment-utilization" | "damage-frequency" | "trends" | "facility-report-history" }) {
  return request<never>(`/admin/analytics/export${queryString(input)}`);
}

export function analyticsQuery(input: AnalyticsFilters & Record<string, string | number | undefined>) {
  return queryString(input);
}
