-- Nama/nomor laporan unik agar pelapor dan petugas dapat merujuk laporan dengan
-- identifier manusia yang mudah dibaca (FR-REP-04).
ALTER TABLE "facility_reports" ADD COLUMN "report_number" VARCHAR(32);

-- Backfill untuk baris historis bila ada: nomor dibentuk dari id dan waktu pembuatan.
UPDATE "facility_reports"
SET "report_number" = 'RPT-' || to_char(("created_at" AT TIME ZONE 'Asia/Jakarta'), 'YYYYMMDDHH24MISS') || '-' || upper(substr(md5("id"::text), 1, 6))
WHERE "report_number" IS NULL;

ALTER TABLE "facility_reports" ALTER COLUMN "report_number" SET NOT NULL;

CREATE UNIQUE INDEX "facility_reports_report_number_key" ON "facility_reports"("report_number");

-- Perubahan status fasilitas dari proses terjadwal (mis. periode perbaikan berakhir
-- otomatis pada end_at) tidak memiliki pelaku manusia. `changed_by` dibuat nullable,
-- konsisten dengan `audit_logs.actor_id` dan catatan PRD bahwa aksi sistem boleh kosong.
ALTER TABLE "facility_status_history" ALTER COLUMN "changed_by" DROP NOT NULL;