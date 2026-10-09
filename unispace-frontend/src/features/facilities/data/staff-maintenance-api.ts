import type { AuthenticatedRequestFn } from "@/features/reservations/api";

export type StaffMaintenanceState = "ACTIVE" | "SCHEDULED";

export type StaffMaintenancePeriod = {
  endAt: string;
  facility: {
    assetCode: string;
    id: string;
    name: string | null;
    facilityGroup: {
      id: string;
      name: string;
      reservationMode: "EXCLUSIVE" | "QUANTITY";
      facilityArea: { id: string; name: string };
    };
  };
  id: string;
  note: string | null;
  report: {
    categoryLabel: string;
    id: string;
    reportNumber: string;
    status: string;
  } | null;
  startAt: string;
  state: StaffMaintenanceState;
};

export type StaffMaintenanceResponse = {
  items: StaffMaintenancePeriod[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type DirectMaintenanceWindowPayload = {
  mode: "DATE_RANGE" | "TIME_RANGE";
  startDate?: string;
  endDate?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

export type CreateDirectMaintenancePayload = DirectMaintenanceWindowPayload & {
  note: string;
  cancellationReason: string;
  cancelImpactedReservations: true;
};

export type MaintenanceImpactResponse = {
  facilityId: string;
  approvedReservations: Array<{
    id: string;
    usageDate: string;
    startTime: string;
    endTime: string;
  }>;
  pendingReservations: Array<{
    id: string;
    usageDate: string;
    startTime: string;
    endTime: string;
    requestedQuantity: number;
  }>;
};

export function listStaffMaintenance(
  request: AuthenticatedRequestFn,
  input: { page?: number; state?: "ALL" | StaffMaintenanceState },
) {
  const query = new URLSearchParams({
    limit: "20",
    page: String(input.page ?? 1),
    state: input.state ?? "ALL",
  });
  return request<StaffMaintenanceResponse>(
    `/staff/facilities/maintenance?${query.toString()}`,
  );
}

export function previewDirectFacilityMaintenance(
  request: AuthenticatedRequestFn,
  facilityId: string,
  payload: DirectMaintenanceWindowPayload,
) {
  return request<MaintenanceImpactResponse>(
    `/staff/facilities/${facilityId}/maintenance/preview`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function createDirectFacilityMaintenance(
  request: AuthenticatedRequestFn,
  facilityId: string,
  payload: CreateDirectMaintenancePayload,
  idempotencyKey: string,
) {
  return request<void>(`/staff/facilities/${facilityId}/maintenance`, {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
