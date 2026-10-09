CREATE TYPE "facility_type_status" AS ENUM ('ACTIVE', 'NONACTIVE');

ALTER TABLE "facility_types"
ADD COLUMN "status" "facility_type_status" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "facility_types_status_name_idx"
ON "facility_types"("status", "name");
