-- Metadata object key membuat lifecycle foto fasilitas dapat dikelola tanpa
-- mengandalkan parsing URL. Kolom nullable agar migration tidak melakukan
-- backfill atau mengubah data fasilitas lama secara diam-diam.
ALTER TABLE "facility_groups"
ADD COLUMN "primary_image_object_key" TEXT;

ALTER TABLE "facilities"
ADD COLUMN "primary_image_object_key" TEXT;

-- Mendukung filter audit global dan rentang waktu export tanpa mengubah data.
CREATE INDEX "audit_logs_action_created_at_idx"
ON "audit_logs"("action", "created_at");

CREATE INDEX "audit_logs_created_at_idx"
ON "audit_logs"("created_at");
