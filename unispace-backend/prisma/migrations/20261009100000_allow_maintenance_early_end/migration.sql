ALTER TABLE "maintenance_periods"
ADD COLUMN "ended_early" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "maintenance_periods"
DROP CONSTRAINT "maintenance_periods_half_hour_slots";

ALTER TABLE "maintenance_periods"
ADD CONSTRAINT "maintenance_periods_half_hour_slots" CHECK (
    extract(minute FROM "start_at") IN (0, 30)
    AND extract(second FROM "start_at") = 0
    AND (
        "ended_early"
        OR (
            extract(minute FROM "end_at") IN (0, 30)
            AND extract(second FROM "end_at") = 0
        )
    )
);
