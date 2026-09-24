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

export type CatalogFacilityDetail = CatalogFacility & {
  activeUnits?: number;
  assetCode?: string;
};

export async function fetchFacilityDetail(id: string): Promise<CatalogFacilityDetail> {
  // 1. Coba fetch sebagai unit EXCLUSIVE
  try {
    const item = await apiRequest<PublicCatalogItem>(`/facilities/${id}`);
    const facility = toCatalogFacility(item);
    return {
      ...facility,
      assetCode: item.assetCode,
    };
  } catch {
    // 2. Coba fetch sebagai kelompok alat QUANTITY jika unit gagal
    try {
      const groupItem = await apiRequest<PublicCatalogItem>(`/facilities/${id}?kind=group`);
      const facility = toCatalogFacility(groupItem);
      return {
        ...facility,
        activeUnits: groupItem.activeUnits,
      };
    } catch {
      // 3. Fallback ke data mock jika API backend belum ada data / offline
      const { landingFacilities } = await import("./landing-facilities");
      const fallback = landingFacilities.find((f) => f.id === id);
      if (fallback) {
        return {
          ...fallback,
          activeUnits:
            fallback.availability.kind === "QUANTITY" && "activeUnits" in fallback.availability
              ? fallback.availability.activeUnits
              : undefined,
          kind: fallback.availability.kind,
        };
      }
      throw new Error("Fasilitas tidak ditemukan.");
    }
  }
}

