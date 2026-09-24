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
  purpose: string;
};

export type ReservationSummary = {
  canCancel: boolean;
  cancellationReason?: string | null;
  createdAt: string;
  decisionDeadline?: string;
  endTime: string;
  id: string;
  purpose: string;
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
