export type FacilityMode = "EXCLUSIVE" | "QUANTITY";
export type FacilityUnitStatus = "ACTIVE" | "NONACTIVE";
export type FacilityAreaStatus = "ACTIVE" | "NONACTIVE";

export type AdminFacilityType = {
  id: string;
  name: string;
};

export type AdminFacilityArea = {
  _count: { facilityGroups: number };
  code: string;
  id: string;
  name: string;
  status: FacilityAreaStatus;
};

export type AdminFacilityUnit = {
  assetCode: string;
  capacity: number | null;
  createdAt: string;
  description: string | null;
  id: string;
  name: string | null;
  primaryImageUrl: string | null;
  status: FacilityUnitStatus;
};

export type AdminFacilityGroup = {
  capacity: number | null;
  description: string | null;
  facilities: AdminFacilityUnit[];
  facilityArea: Pick<AdminFacilityArea, "code" | "id" | "name">;
  facilityAreaId: string;
  facilityType: AdminFacilityType;
  facilityTypeId: string;
  id: string;
  locationDetail: string;
  name: string;
  primaryImageUrl: string | null;
  reservationMode: FacilityMode;
};

export function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
