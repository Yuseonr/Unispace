-- FacilityArea adalah master wilayah kampus: fakultas, rektorat, dan fasilitas umum.
CREATE TYPE "facility_area_status" AS ENUM ('ACTIVE', 'NONACTIVE');

CREATE TABLE "facility_areas" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "facility_area_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "facility_areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "facility_areas_code_key" ON "facility_areas"("code");
CREATE UNIQUE INDEX "facility_areas_name_key" ON "facility_areas"("name");
CREATE INDEX "facility_areas_status_name_idx" ON "facility_areas"("status", "name");

ALTER TABLE "facility_groups"
DROP CONSTRAINT "facility_groups_location_id_fkey",
DROP CONSTRAINT "quantity_group_catalog_required",
DROP COLUMN "location_id",
ADD COLUMN "facility_area_id" UUID NOT NULL,
ADD COLUMN "location_detail" TEXT NOT NULL;

ALTER TABLE "facilities"
DROP CONSTRAINT "facilities_location_id_fkey",
DROP COLUMN "location_id";

DROP TABLE "locations";

ALTER TABLE "facility_areas"
ADD CONSTRAINT "facility_areas_code_format" CHECK ("code" ~ '^[A-Z0-9_]{2,30}$'),
ADD CONSTRAINT "facility_areas_code_uppercase" CHECK ("code" = UPPER("code")),
ADD CONSTRAINT "facility_areas_name_length" CHECK (length(BTRIM("name")) BETWEEN 2 AND 120);

ALTER TABLE "facility_groups"
ADD CONSTRAINT "facility_groups_location_detail_length" CHECK (length(BTRIM("location_detail")) BETWEEN 1 AND 500),
ADD CONSTRAINT "quantity_group_catalog_required" CHECK (
    "reservation_mode" <> 'QUANTITY'
    OR (
        nullif(BTRIM("location_detail"), '') IS NOT NULL
        AND nullif(BTRIM("description"), '') IS NOT NULL
        AND nullif(BTRIM("primary_image_url"), '') IS NOT NULL
    )
);

ALTER TABLE "facility_groups"
ADD CONSTRAINT "facility_groups_facility_area_id_fkey"
FOREIGN KEY ("facility_area_id") REFERENCES "facility_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "facility_groups_facility_area_id_idx" ON "facility_groups"("facility_area_id");
