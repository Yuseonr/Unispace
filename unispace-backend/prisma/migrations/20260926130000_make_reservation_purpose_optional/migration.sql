-- Purpose reservasi memang opsional pada alur pengajuan MVP.
ALTER TABLE "reservations" ALTER COLUMN "purpose" DROP NOT NULL;
