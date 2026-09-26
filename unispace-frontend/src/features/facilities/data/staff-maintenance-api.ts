import type { AuthenticatedRequestFn } from "@/features/reservations/api";

export type StaffMaintenanceState = "ACTIVE" | "SCHEDULED";

export type StaffMaintenancePeriod = {
  endAt: string;
  facility: {
    assetCode: string;
    id: string;
    name: string | null;
    facilityGroup: { id: string; name: string; reservationMode: "EXCLUSIVE" | "QUANTITY"; facilityArea: { id: string; name: string } };
  };
  id: string;
  note: string | null;
  report: { categoryLabel: string; id: string; reportNumber: string; status: string };
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

export function listStaffMaintenance(request: AuthenticatedRequestFn, input: { page?: number; state?: "ALL" | StaffMaintenanceState }) {
  const query = new URLSearchParams({ limit: "20", page: String(input.page ?? 1), state: input.state ?? "ALL" });
  return request<StaffMaintenanceResponse>(`/staff/facilities/maintenance?${query.toString()}`);
}
