import {
  ReportCategory,
  ReportStatus,
  StorageProvider,
} from '../generated/prisma/client';

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  [ReportCategory.PHYSICAL_DAMAGE]: 'Kerusakan Fisik',
  [ReportCategory.ELECTRICAL_ELECTRONICS]: 'Listrik/Elektronik',
  [ReportCategory.CLEANLINESS]: 'Kebersihan',
  [ReportCategory.FURNITURE_EQUIPMENT]: 'Furnitur/Perlengkapan',
  [ReportCategory.SECURITY]: 'Keamanan',
  [ReportCategory.OTHER]: 'Lainnya',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  [ReportStatus.NEW]: 'Baru',
  [ReportStatus.IN_PROGRESS]: 'Diproses',
  [ReportStatus.RESOLVED]: 'Selesai',
  [ReportStatus.REJECTED]: 'Ditolak',
};

export const STORAGE_PROVIDER_LABELS: Record<StorageProvider, string> = {
  [StorageProvider.MINIO]: 'MinIO',
  [StorageProvider.S3]: 'S3',
};

export enum MaintenanceMode {
  DATE_RANGE = 'DATE_RANGE',
  TIME_RANGE = 'TIME_RANGE',
}

export const REPORT_ATTACHMENT_LIMITS = {
  maxCount: 3,
  maxSizeBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
};

export const REPORT_ENTITY_TYPE = 'FACILITY_REPORT';
export const MAINTENANCE_ENTITY_TYPE = 'MAINTENANCE_PERIOD';
export const FACILITY_ENTITY_TYPE = 'FACILITY';

export const REPORT_AUDIT_ACTIONS = {
  CREATED: 'REPORT_CREATED',
  ACCEPTED: 'REPORT_ACCEPTED',
  REJECTED: 'REPORT_REJECTED',
  RESOLVED: 'REPORT_RESOLVED',
  MAINTENANCE_CREATED: 'MAINTENANCE_PERIOD_CREATED',
  MAINTENANCE_ENDED_EARLY: 'MAINTENANCE_PERIOD_ENDED_EARLY',
  MAINTENANCE_IMPACT_CONFIRMED: 'MAINTENANCE_IMPACT_CONFIRMED',
  FACILITY_STATUS_CHANGED: 'FACILITY_STATUS_CHANGED',
} as const;
