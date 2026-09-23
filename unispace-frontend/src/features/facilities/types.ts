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
  id: string;
  location: string;
  name: string;
  status: FacilityStatus;
  type: FacilityType;
  visualTheme: FacilityVisualTheme;
};
