export const facilityTypes = [
  "Ruang",
  "Aula",
  "Laboratorium",
  "Lapangan",
  "Peralatan",
] as const;

export type FacilityType = (typeof facilityTypes)[number];
export type FacilityStatus = "ACTIVE" | "MAINTENANCE";
export type FacilityVisualTheme = "forest" | "sage" | "sun" | "mint";

export type FacilityArea = {
  code: string;
  id?: string;
  name: string;
};

type ExclusiveAvailability = {
  kind: "EXCLUSIVE";
  label: string;
};

type QuantityAvailability = {
  activeUnits?: number;
  availableUnits?: number;
  kind: "QUANTITY";
  totalActiveUnits?: number;
};

export type CatalogFacility = {
  availability: ExclusiveAvailability | QuantityAvailability;
  capacity: number | null;
  description?: string | null;
  facilityArea: FacilityArea;
  facilityTypeId?: string;
  id: string;
  kind?: "EXCLUSIVE" | "QUANTITY";
  locationDetail: string;
  name: string;
  primaryImageUrl?: string | null;
  status: FacilityStatus;
  type: string;
  visualTheme: FacilityVisualTheme;
};
