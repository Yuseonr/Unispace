import { apiRequest } from "@/lib/api/client";

import type {
  CatalogFacility,
  FacilityStatus,
  FacilityType,
  FacilityVisualTheme,
} from "../types";

export type CatalogFilterOption = { code?: string; id: string; name: string };

export type CatalogQuery = {
  facilityAreaId?: string;
  facilityTypeId?: string;
  limit?: number;
  minCapacity?: number;
  page?: number;
  search?: string;
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
  nextMaintenance?: { endAt: string; startAt: string };
  primaryImageUrl: string | null;
  status: "ACTIVE" | "MAINTENANCE";
};

type CatalogSegment = {
  data: PublicCatalogItem[];
  limit: number;
  page: number;
  total: number;
};

type PublicCatalogResponse = {
  exclusive: CatalogSegment;
  quantity: CatalogSegment;
};

function queryString(input: CatalogQuery) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

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

export async function fetchPublicCatalog(input: CatalogQuery = {}) {
  const [catalog, types, areas] = await Promise.all([
    apiRequest<PublicCatalogResponse>(
      `/facilities${queryString({ limit: 12, page: 1, ...input })}`,
    ),
    apiRequest<CatalogFilterOption[]>("/facilities/types"),
    apiRequest<CatalogFilterOption[]>("/facilities/areas"),
  ]);
  const total = catalog.exclusive.total + catalog.quantity.total;
  return {
    areas,
    facilities: [...catalog.exclusive.data, ...catalog.quantity.data].map(
      toCatalogFacility,
    ),
    limit: catalog.exclusive.limit + catalog.quantity.limit,
    page: catalog.exclusive.page,
    total,
    totalPages: Math.max(
      Math.ceil(catalog.exclusive.total / catalog.exclusive.limit),
      Math.ceil(catalog.quantity.total / catalog.quantity.limit),
      1,
    ),
    types,
  };
}

export async function fetchFeaturedFacilities() {
  const catalog = await fetchPublicCatalog({ limit: 3, page: 1 });
  return catalog.facilities.slice(0, 3);
}

export type CatalogFacilityDetail = CatalogFacility & {
  activeUnits?: number;
  assetCode?: string;
  nextMaintenance?: { endAt: string; startAt: string };
};

export async function fetchFacilityDetail(
  id: string,
): Promise<CatalogFacilityDetail> {
  try {
    const item = await apiRequest<PublicCatalogItem>(`/facilities/${id}`);
    return {
      ...toCatalogFacility(item),
      assetCode: item.assetCode,
      nextMaintenance: item.nextMaintenance,
    };
  } catch {
    const group = await apiRequest<PublicCatalogItem>(
      `/facilities/${id}?kind=group`,
    );
    return {
      ...toCatalogFacility(group),
      activeUnits: group.activeUnits,
      nextMaintenance: group.nextMaintenance,
    };
  }
}
