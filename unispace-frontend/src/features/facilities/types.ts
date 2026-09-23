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
  name: string;
};

type ExclusiveAvailability = {
  kind: "EXCLUSIVE";
  label: string;
};

type QuantityAvailability = {
  availableUnits: number;
  kind: "QUANTITY";
  totalActiveUnits: number;
};

export type CatalogFacility = {
  availability: ExclusiveAvailability | QuantityAvailability;
  capacity: number | null;
  facilityArea: FacilityArea;
  id: string;
  locationDetail: string;
  name: string;
  status: FacilityStatus;
  type: FacilityType;
  visualTheme: FacilityVisualTheme;
};
