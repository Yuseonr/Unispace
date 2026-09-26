-- Add a stable human-readable identifier for reservation responses and staff workflows.
ALTER TABLE "reservations" ADD COLUMN "reservation_number" VARCHAR(32);

UPDATE "reservations"
SET "reservation_number" = 'RSV-' ||
  to_char(("created_at" AT TIME ZONE 'Asia/Jakarta'), 'YYYYMMDDHH24MISS') || '-' ||
  upper(substr(md5("id"::text), 1, 6))
WHERE "reservation_number" IS NULL;

ALTER TABLE "reservations" ALTER COLUMN "reservation_number" SET NOT NULL;
CREATE UNIQUE INDEX "reservations_reservation_number_key"
  ON "reservations"("reservation_number");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "reservations"
    WHERE NOT (("facility_id" IS NULL) <> ("facility_group_id" IS NULL))
  ) THEN
    RAISE EXCEPTION
      'Cannot add reservations_exactly_one_target: existing reservation has zero or multiple targets';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "reservations"
    WHERE "requested_quantity" <= 0
  ) THEN
    RAISE EXCEPTION
      'Cannot add reservations_requested_quantity_positive: existing reservation has non-positive quantity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "reservations"
    WHERE "start_time" >= "end_time"
  ) THEN
    RAISE EXCEPTION
      'Cannot add reservations_time_range_valid: existing reservation has invalid time range';
  END IF;
END $$;

