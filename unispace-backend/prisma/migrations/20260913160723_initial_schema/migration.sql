-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'REJECTED', 'NONACTIVE');

-- CreateEnum
CREATE TYPE "reservation_mode" AS ENUM ('EXCLUSIVE', 'QUANTITY');

-- CreateEnum
CREATE TYPE "facility_status" AS ENUM ('ACTIVE', 'NONACTIVE');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED_BY_USER', 'CANCELLED_BY_STAFF', 'CANCELLED_BY_SYSTEM', 'COMPLETED');

-- CreateEnum
CREATE TYPE "report_category" AS ENUM ('PHYSICAL_DAMAGE', 'ELECTRICAL_ELECTRONICS', 'CLEANLINESS', 'FURNITURE_EQUIPMENT', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "storage_provider" AS ENUM ('MINIO', 'S3');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "identity_number" VARCHAR(50) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "refresh_token_hash" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "account_status" "account_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verification_reason" TEXT,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "facility_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "detail" TEXT,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "facility_type_id" UUID NOT NULL,
    "reservation_mode" "reservation_mode" NOT NULL,
    "location_id" UUID,
    "capacity" INTEGER,
    "description" TEXT,
    "primary_image_url" TEXT,

    CONSTRAINT "facility_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "facility_group_id" UUID NOT NULL,
    "asset_code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(150),
    "location_id" UUID,
    "capacity" INTEGER,
    "description" TEXT,
    "primary_image_url" TEXT,
    "status" "facility_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_status_history" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "status" "facility_status" NOT NULL,
    "changed_by" UUID NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "facility_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "facility_id" UUID,
    "facility_group_id" UUID,
    "requested_quantity" INTEGER NOT NULL DEFAULT 1,
    "usage_date" DATE NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'NULL',
    "status" "reservation_status" NOT NULL DEFAULT 'PENDING',
    "decision_deadline" TIMESTAMPTZ(3) NOT NULL,
    "decision_reason" TEXT,
    "processed_by" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_items" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "allocated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "category" "report_category" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'NEW',
    "decision_reason" TEXT,
    "resolution_note" TEXT,
    "accepted_by" UUID,
    "accepted_at" TIMESTAMPTZ(3),
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "processed_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "facility_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "storage_provider" "storage_provider" NOT NULL,
    "object_key" TEXT NOT NULL,
    "object_url" TEXT NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_periods" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "maintenance_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_identity_number_key" ON "users"("identity_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_account_status_role_idx" ON "users"("account_status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "facility_types_name_key" ON "facility_types"("name");

-- CreateIndex
CREATE INDEX "locations_name_idx" ON "locations"("name");

-- CreateIndex
CREATE INDEX "facility_groups_facility_type_id_reservation_mode_idx" ON "facility_groups"("facility_type_id", "reservation_mode");

-- CreateIndex
CREATE INDEX "facility_groups_location_id_idx" ON "facility_groups"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_asset_code_key" ON "facilities"("asset_code");

-- CreateIndex
CREATE INDEX "facilities_facility_group_id_status_idx" ON "facilities"("facility_group_id", "status");

-- CreateIndex
CREATE INDEX "facilities_location_id_idx" ON "facilities"("location_id");

-- CreateIndex
CREATE INDEX "facility_status_history_facility_id_effective_at_idx" ON "facility_status_history"("facility_id", "effective_at");

-- CreateIndex
CREATE INDEX "facility_status_history_changed_by_idx" ON "facility_status_history"("changed_by");

-- CreateIndex
CREATE INDEX "reservations_user_id_status_usage_date_idx" ON "reservations"("user_id", "status", "usage_date");

-- CreateIndex
CREATE INDEX "reservations_facility_id_usage_date_start_time_end_time_sta_idx" ON "reservations"("facility_id", "usage_date", "start_time", "end_time", "status");

-- CreateIndex
CREATE INDEX "reservations_facility_group_id_usage_date_start_time_end_ti_idx" ON "reservations"("facility_group_id", "usage_date", "start_time", "end_time", "status");

-- CreateIndex
CREATE INDEX "reservations_status_decision_deadline_idx" ON "reservations"("status", "decision_deadline");

-- CreateIndex
CREATE INDEX "reservations_processed_by_idx" ON "reservations"("processed_by");

-- CreateIndex
CREATE INDEX "reservation_items_facility_id_idx" ON "reservation_items"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_items_reservation_id_facility_id_key" ON "reservation_items"("reservation_id", "facility_id");

-- CreateIndex
CREATE INDEX "facility_reports_reporter_id_status_created_at_idx" ON "facility_reports"("reporter_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "facility_reports_facility_id_status_created_at_idx" ON "facility_reports"("facility_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "facility_reports_status_created_at_idx" ON "facility_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "facility_reports_accepted_by_idx" ON "facility_reports"("accepted_by");

-- CreateIndex
CREATE INDEX "facility_reports_resolved_by_idx" ON "facility_reports"("resolved_by");

-- CreateIndex
CREATE INDEX "facility_reports_processed_by_idx" ON "facility_reports"("processed_by");

-- CreateIndex
CREATE INDEX "report_attachments_report_id_idx" ON "report_attachments"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_attachments_storage_provider_object_key_key" ON "report_attachments"("storage_provider", "object_key");

-- CreateIndex
CREATE INDEX "maintenance_periods_facility_id_start_at_end_at_idx" ON "maintenance_periods"("facility_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "maintenance_periods_report_id_start_at_end_at_idx" ON "maintenance_periods"("report_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_groups" ADD CONSTRAINT "facility_groups_facility_type_id_fkey" FOREIGN KEY ("facility_type_id") REFERENCES "facility_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_groups" ADD CONSTRAINT "facility_groups_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_facility_group_id_fkey" FOREIGN KEY ("facility_group_id") REFERENCES "facility_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_status_history" ADD CONSTRAINT "facility_status_history_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_status_history" ADD CONSTRAINT "facility_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_facility_group_id_fkey" FOREIGN KEY ("facility_group_id") REFERENCES "facility_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_reports" ADD CONSTRAINT "facility_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_reports" ADD CONSTRAINT "facility_reports_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_reports" ADD CONSTRAINT "facility_reports_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_reports" ADD CONSTRAINT "facility_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_reports" ADD CONSTRAINT "facility_reports_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "facility_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_periods" ADD CONSTRAINT "maintenance_periods_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_periods" ADD CONSTRAINT "maintenance_periods_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "facility_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business constraints from PRD
ALTER TABLE "users"
ADD CONSTRAINT "users_name_not_blank" CHECK (length(btrim("name")) > 0),
ADD CONSTRAINT "users_identity_number_not_blank" CHECK (length(btrim("identity_number")) > 0),
ADD CONSTRAINT "users_email_not_blank" CHECK (length(btrim("email")) > 0),
ADD CONSTRAINT "users_rejection_reason_required" CHECK (
    "account_status" <> 'REJECTED' OR nullif(btrim("verification_reason"), '') IS NOT NULL
);

ALTER TABLE "facility_types"
ADD CONSTRAINT "facility_types_name_not_blank" CHECK (length(btrim("name")) > 0);

ALTER TABLE "locations"
ADD CONSTRAINT "locations_name_not_blank" CHECK (length(btrim("name")) > 0);

ALTER TABLE "facility_groups"
ADD CONSTRAINT "facility_groups_name_not_blank" CHECK (length(btrim("name")) > 0),
ADD CONSTRAINT "facility_groups_capacity_nonnegative" CHECK ("capacity" IS NULL OR "capacity" >= 0),
ADD CONSTRAINT "quantity_group_catalog_required" CHECK (
    "reservation_mode" <> 'QUANTITY'
    OR (
        "location_id" IS NOT NULL
        AND nullif(btrim("description"), '') IS NOT NULL
        AND nullif(btrim("primary_image_url"), '') IS NOT NULL
    )
);

ALTER TABLE "facilities"
ADD CONSTRAINT "facilities_asset_code_not_blank" CHECK (length(btrim("asset_code")) > 0),
ADD CONSTRAINT "facilities_capacity_nonnegative" CHECK ("capacity" IS NULL OR "capacity" >= 0);

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_exactly_one_target" CHECK (
    (
        "facility_id" IS NOT NULL
        AND "facility_group_id" IS NULL
        AND "requested_quantity" = 1
    )
    OR (
        "facility_id" IS NULL
        AND "facility_group_id" IS NOT NULL
        AND "requested_quantity" > 0
    )
),
ADD CONSTRAINT "reservations_time_order" CHECK ("start_time" < "end_time"),
ADD CONSTRAINT "reservations_operating_hours" CHECK (
    "start_time" >= TIME '07:00:00' AND "end_time" <= TIME '20:00:00'
),
ADD CONSTRAINT "reservations_half_hour_slots" CHECK (
    extract(minute FROM "start_time") IN (0, 30)
    AND extract(second FROM "start_time") = 0
    AND extract(minute FROM "end_time") IN (0, 30)
    AND extract(second FROM "end_time") = 0
),
ADD CONSTRAINT "reservations_weekdays_only" CHECK (
    extract(isodow FROM "usage_date") BETWEEN 1 AND 5
),
ADD CONSTRAINT "reservations_max_14_days_ahead" CHECK (
    "usage_date" <= (("created_at" AT TIME ZONE 'Asia/Jakarta')::date + 14)
),
ADD CONSTRAINT "reservations_decision_reason_required" CHECK (
    "status" NOT IN ('REJECTED', 'CANCELLED_BY_STAFF', 'CANCELLED_BY_SYSTEM')
    OR nullif(btrim("decision_reason"), '') IS NOT NULL
),
ADD CONSTRAINT "reservations_decision_time_required" CHECK (
    "status" NOT IN ('APPROVED', 'REJECTED') OR "decided_at" IS NOT NULL
),
ADD CONSTRAINT "reservations_cancellation_time_required" CHECK (
    "status" NOT IN ('CANCELLED_BY_USER', 'CANCELLED_BY_STAFF', 'CANCELLED_BY_SYSTEM')
    OR "cancelled_at" IS NOT NULL
);

-- PostgreSQL exclusion constraint is the final database guard against two
-- APPROVED reservations occupying the same EXCLUSIVE facility at once.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_no_approved_facility_overlap"
EXCLUDE USING gist (
    "facility_id" WITH =,
    tsrange("usage_date" + "start_time", "usage_date" + "end_time", '[)') WITH &&
)
WHERE ("status" = 'APPROVED' AND "facility_id" IS NOT NULL);

ALTER TABLE "facility_reports"
ADD CONSTRAINT "facility_reports_description_not_blank" CHECK (length(btrim("description")) > 0),
ADD CONSTRAINT "facility_reports_acceptance_pair" CHECK (
    ("accepted_by" IS NULL) = ("accepted_at" IS NULL)
),
ADD CONSTRAINT "facility_reports_resolution_pair" CHECK (
    ("resolved_by" IS NULL) = ("resolved_at" IS NULL)
),
ADD CONSTRAINT "facility_reports_acceptance_required" CHECK (
    "status" NOT IN ('IN_PROGRESS', 'RESOLVED')
    OR ("accepted_by" IS NOT NULL AND "accepted_at" IS NOT NULL)
),
ADD CONSTRAINT "facility_reports_rejection_reason_required" CHECK (
    "status" <> 'REJECTED' OR nullif(btrim("decision_reason"), '') IS NOT NULL
),
ADD CONSTRAINT "facility_reports_resolution_required" CHECK (
    "status" <> 'RESOLVED'
    OR (
        nullif(btrim("resolution_note"), '') IS NOT NULL
        AND "resolved_by" IS NOT NULL
        AND "resolved_at" IS NOT NULL
    )
);

ALTER TABLE "report_attachments"
ADD CONSTRAINT "report_attachments_allowed_mime" CHECK (
    "mime_type" IN ('image/jpeg', 'image/png', 'image/webp')
),
ADD CONSTRAINT "report_attachments_size_limit" CHECK (
    "size_bytes" > 0 AND "size_bytes" <= 5242880
),
ADD CONSTRAINT "report_attachments_filename_not_blank" CHECK (
    length(btrim("original_filename")) > 0
),
ADD CONSTRAINT "report_attachments_object_key_not_blank" CHECK (
    length(btrim("object_key")) > 0
);

ALTER TABLE "maintenance_periods"
ADD CONSTRAINT "maintenance_periods_time_order" CHECK ("start_at" < "end_at"),
ADD CONSTRAINT "maintenance_periods_half_hour_slots" CHECK (
    extract(minute FROM "start_at") IN (0, 30)
    AND extract(second FROM "start_at") = 0
    AND extract(minute FROM "end_at") IN (0, 30)
    AND extract(second FROM "end_at") = 0
);

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_action_not_blank" CHECK (length(btrim("action")) > 0),
ADD CONSTRAINT "audit_logs_entity_type_not_blank" CHECK (length(btrim("entity_type")) > 0);
