-- AlterTable: Make description optional for QUANTITY facility groups by updating the check constraint
ALTER TABLE "facility_groups" DROP CONSTRAINT "quantity_group_catalog_required";

ALTER TABLE "facility_groups" ADD CONSTRAINT "quantity_group_catalog_required" CHECK (
    "reservation_mode" <> 'QUANTITY'
    OR (
        nullif(BTRIM("location_detail"), '') IS NOT NULL
        AND nullif(BTRIM("primary_image_url"), '') IS NOT NULL
    )
);
