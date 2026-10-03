-- DropForeignKey
ALTER TABLE "maintenance_periods" DROP CONSTRAINT "maintenance_periods_report_id_fkey";

-- AlterTable
ALTER TABLE "maintenance_periods" ALTER COLUMN "report_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "maintenance_periods" ADD CONSTRAINT "maintenance_periods_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "facility_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
