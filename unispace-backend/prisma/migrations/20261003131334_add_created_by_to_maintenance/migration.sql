-- AlterTable
ALTER TABLE "maintenance_periods" ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by_id" UUID;

-- AddForeignKey
ALTER TABLE "maintenance_periods" ADD CONSTRAINT "maintenance_periods_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
