-- Preserve legacy reservations while making new reservation purposes mandatory.
UPDATE "reservations"
SET "purpose" = 'Tidak diisi (data lama)'
WHERE "purpose" IS NULL OR btrim("purpose") = '';

ALTER TABLE "reservations"
ALTER COLUMN "purpose" SET NOT NULL;

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_purpose_not_blank"
CHECK (char_length(btrim("purpose")) > 0);
