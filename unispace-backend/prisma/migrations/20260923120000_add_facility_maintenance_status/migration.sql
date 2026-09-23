-- Add the derived operational status used while a maintenance period is active.
ALTER TYPE "facility_status" ADD VALUE IF NOT EXISTS 'IN_MAINTENANCE' AFTER 'ACTIVE';