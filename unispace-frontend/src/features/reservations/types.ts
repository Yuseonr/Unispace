export type ReservationMode = "EXCLUSIVE" | "QUANTITY";

export type ReservationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED_BY_USER"
  | "CANCELLED_BY_STAFF"
  | "CANCELLED_BY_SYSTEM"
  | "COMPLETED";

export type SlotAvailabilityReason =
  | "NON_OPERATIONAL_DAY"
  | "FACILITY_INACTIVE"
  | "MAINTENANCE"
  | "BOOKED"
  | "NO_UNITS_AVAILABLE";

export type SlotItem = {
  slotIndex: number;
  startTime: string; // e.g. "07:00"
  endTime: string; // e.g. "07:30"
  available: boolean;
  availableUnits?: number;
  totalUnits?: number;
  reason?: SlotAvailabilityReason | string;
};

export type FacilityAvailabilityData = {
  facilityId?: string;
  facilityGroupId?: string;
  facilityName?: string;
  facilityGroupName?: string;
  reservationMode: ReservationMode;
  usageDate: string;
  isOperationalDay: boolean;
  totalActiveUnits?: number;
  slots: SlotItem[];
};

export type CreateReservationInput = {
  facilityId?: string;
  facilityGroupId?: string;
  requestedQuantity?: number;
  usageDate: string;
  startTime: string;
  endTime: string;
  purpose?: string;
};

export type ReservationSummary = {
  canCancel: boolean;
  cancellationReason?: string | null;
  createdAt: string;
  decisionDeadline?: string;
  endTime: string;
  id: string;
  purpose: string | null;
  rejectionReason?: string | null;
  requestedQuantity: number;
  reservationNumber: string;
  startTime: string;
  status: ReservationStatus;
  usageDate: string;
  allocatedItems?: Array<{
    assetCode: string;
    id: string;
    name?: string;
  }>;
  facility?: {
    assetCode?: string;
    facilityArea?: { code?: string; name: string };
    facilityType?: { name: string };
    id: string;
    locationDetail?: string;
    name: string;
  };
  facilityGroup?: {
    facilityArea?: { code?: string; name: string };
    facilityType?: { name: string };
    id: string;
    locationDetail?: string;
    name: string;
    reservationMode: ReservationMode;
  };
};

export type UserReservationItem = {
  id: string;
  userId: string;
  facilityId?: string | null;
  facilityGroupId?: string | null;
  requestedQuantity: number;
  reservationNumber: string;
  usageDate: string;
  startTime: string;
  endTime: string;
  purpose: string | null;
  status: ReservationStatus;
  decisionDeadline: string;
  decisionReason?: string | null;
  processedById?: string | null;
  decidedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  facility?: {
    id: string;
    name: string;
    assetCode?: string;
    facilityGroup?: {
      id: string;
      name: string;
      locationDetail?: string;
      facilityArea?: { id: string; code?: string; name: string };
      facilityType?: { id: string; name: string };
    } | null;
  } | null;
  facilityGroup?: {
    id: string;
    name: string;
    reservationMode: ReservationMode;
    locationDetail?: string;
    facilityArea?: { id: string; code?: string; name: string };
    facilityType?: { id: string; name: string };
  } | null;
  items?: Array<{
    facility: { id: string; assetCode?: string; name: string };
  }>;
  canCancel: boolean;
  allocatedAssets: Array<{
    id: string;
    assetCode?: string;
    name: string;
  }>;
};

export type MyReservationsPaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type MyReservationsResponse = {
  data: UserReservationItem[];
  meta: MyReservationsPaginationMeta;
};

export type ListMyReservationsQuery = {
  page?: number;
  limit?: number;
  status?: ReservationStatus;
  usageDate?: string;
  view?: "HISTORY";
};

export type StaffReservationUser = {
  id: string;
  name: string;
  email: string;
  identityNumber: string;
};

export type StaffReservationItem = {
  id: string;
  userId: string;
  facilityId?: string | null;
  facilityGroupId?: string | null;
  requestedQuantity: number;
  usageDate: string;
  startTime: string;
  endTime: string;
  purpose: string | null;
  status: ReservationStatus;
  decisionDeadline: string;
  decisionReason?: string | null;
  processedById?: string | null;
  decidedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user: StaffReservationUser;
  facility?: {
    id: string;
    name: string;
    assetCode?: string;
    facilityGroup?: {
      id: string;
      name: string;
      locationDetail?: string;
      facilityArea?: { id: string; code?: string; name: string };
      facilityType?: { id: string; name: string };
    };
  } | null;
  facilityGroup?: {
    id: string;
    name: string;
    reservationMode: ReservationMode;
    locationDetail?: string;
    facilityArea?: { id: string; code?: string; name: string };
    facilityType?: { id: string; name: string };
    facilities?: Array<{
      id: string;
      assetCode?: string;
      name: string;
    }>;
  } | null;
  processedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  items?: Array<{
    facility: { id: string; assetCode?: string; name: string };
  }>;
  allocatedAssets: Array<{
    id: string;
    assetCode?: string;
    name: string;
  }>;
};

export type ListStaffReservationsQuery = {
  page?: number;
  limit?: number;
  status?: ReservationStatus;
  usageDate?: string;
  facilityId?: string;
  facilityGroupId?: string;
  facilityAreaId?: string;
  search?: string;
  view?: "CANCELLED";
};

export type StaffReservationsPaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type StaffReservationsResponse = {
  data: StaffReservationItem[];
  meta: StaffReservationsPaginationMeta;
};

export type ApproveStaffReservationInput = {
  allocatedAssetIds?: string[];
};

export type RejectStaffReservationInput = {
  reason: string;
};

export type CancelStaffReservationInput = {
  reason: string;
};

export type AutoRejectExpiredResponse = {
  success: boolean;
  processedCount: number;
  message: string;
};
