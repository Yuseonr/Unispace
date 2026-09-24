import { apiRequest } from "@/lib/api/client";

import type { CatalogFacility, FacilityStatus, FacilityType, FacilityVisualTheme } from "../types";

export type CatalogFilterOption = {
  code?: string;
  id: string;
  name: string;
};

type PublicCatalogItem = {
  activeUnits?: number;
  assetCode?: string;
  capacity: number | null;
  description: string | null;
  facilityArea: CatalogFilterOption;
  facilityType: CatalogFilterOption;
  id: string;
  kind: "EXCLUSIVE" | "QUANTITY";
  locationDetail: string;
  name: string;
  primaryImageUrl: string | null;
  status: "ACTIVE" | "MAINTENANCE";
};

type PublicCatalogResponse = {
  exclusive: { data: PublicCatalogItem[] };
  quantity: { data: PublicCatalogItem[] };
};

function visualThemeFor(typeName: string): FacilityVisualTheme {
  const normalized = typeName.toLocaleLowerCase("id-ID");
  if (normalized.includes("lapangan")) return "forest";
  if (normalized.includes("alat") || normalized.includes("peralatan")) return "sun";
  if (normalized.includes("laboratorium")) return "mint";
  return "sage";
}

function toCatalogFacility(item: PublicCatalogItem): CatalogFacility {
  return {
    availability:
      item.kind === "QUANTITY"
        ? { activeUnits: item.activeUnits ?? 0, kind: "QUANTITY" }
        : { kind: "EXCLUSIVE", label: "Cek slot untuk hari ini" },
    capacity: item.capacity,
    description: item.description,
    facilityArea: {
      code: item.facilityArea.code ?? item.facilityArea.id,
      id: item.facilityArea.id,
      name: item.facilityArea.name,
    },
    facilityTypeId: item.facilityType.id,
    id: item.id,
    kind: item.kind,
    locationDetail: item.locationDetail,
    name: item.name,
    primaryImageUrl: item.primaryImageUrl,
    status: item.status as FacilityStatus,
    type: item.facilityType.name as FacilityType,
    visualTheme: visualThemeFor(item.facilityType.name),
  };
}

export async function fetchPublicCatalog() {
  const [catalog, types, areas] = await Promise.all([
    apiRequest<PublicCatalogResponse>("/facilities?limit=50"),
    apiRequest<CatalogFilterOption[]>("/facilities/types"),
    apiRequest<CatalogFilterOption[]>("/facilities/areas"),
  ]);

  return {
    areas,
    facilities: [...catalog.exclusive.data, ...catalog.quantity.data].map(toCatalogFacility),
    types,
  };
}
