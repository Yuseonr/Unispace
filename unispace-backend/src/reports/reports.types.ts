import {
  ReportCategory,
  ReportStatus,
  StorageProvider,
} from '../generated/prisma/client';

export type ReportAttachmentResponse = {
  id: string;
  storageProvider: StorageProvider;
  downloadUrl: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ReportFacilityResponse = {
  id: string;
  assetCode: string;
  name: string | null;
  status: string;
  facilityGroupId: string;
  facilityGroupName: string;
  reservationMode: string;
};

export type ReportUserResponse = {
  id: string;
  name: string;
  identityNumber?: string;
  email?: string;
};

export type MaintenancePeriodResponse = {
  id: string;
  reportId: string;
  facilityId: string;
  startAt: string;
  endAt: string;
  note: string | null;
};

export type ReportResponse = {
  id: string;
  reportNumber: string;
  reporter?: ReportUserResponse;
  facility: ReportFacilityResponse;
  category: ReportCategory;
  categoryLabel: string;
  description: string;
  status: ReportStatus;
  statusLabel: string;
  decisionReason: string | null;
  resolutionNote: string | null;
  acceptedBy: ReportUserResponse | null;
  acceptedAt: string | null;
  resolvedBy: ReportUserResponse | null;
  resolvedAt: string | null;
  processedBy: ReportUserResponse | null;
  attachments: ReportAttachmentResponse[];
  maintenancePeriods: MaintenancePeriodResponse[];
  createdAt: string;
  updatedAt: string;
};

export type PaginatedReportsResponse = {
  items: ReportResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type MaintenanceImpactResponse = {
  reportId: string;
  facilityId: string;
  approvedReservations: Array<{
    id: string;
    usageDate: string;
    startTime: string;
    endTime: string;
  }>;
  pendingReservations: Array<{
    id: string;
    usageDate: string;
    startTime: string;
    endTime: string;
    requestedQuantity: number;
  }>;
};

export type ReportAuditLogResponse = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    role: string;
  } | null;
};
