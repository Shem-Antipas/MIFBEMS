ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'FISHERMAN';
ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'FISH_TRADER';
ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'BOAT';

ALTER TYPE "LicenseStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "LicenseStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "License"
  ADD COLUMN IF NOT EXISTS "receiptNo" TEXT,
  ADD COLUMN IF NOT EXISTS "bmuName" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "License_receiptNo_key" ON "License"("receiptNo");

CREATE TABLE IF NOT EXISTS "CaptureFisheriesRecord" (
  "id" TEXT NOT NULL,
  "fisherName" TEXT NOT NULL,
  "bmuName" TEXT,
  "landingSite" TEXT,
  "species" TEXT NOT NULL,
  "catchKg" DOUBLE PRECISION NOT NULL,
  "effortHours" DOUBLE PRECISION,
  "fishingDate" TIMESTAMP(3) NOT NULL,
  "subCounty" TEXT NOT NULL DEFAULT 'Nyatike',
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaptureFisheriesRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CaptureFisheriesRecord_subCounty_idx" ON "CaptureFisheriesRecord"("subCounty");
CREATE INDEX IF NOT EXISTS "CaptureFisheriesRecord_fishingDate_idx" ON "CaptureFisheriesRecord"("fishingDate");
CREATE INDEX IF NOT EXISTS "CaptureFisheriesRecord_recordedById_idx" ON "CaptureFisheriesRecord"("recordedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CaptureFisheriesRecord_recordedById_fkey'
  ) THEN
    ALTER TABLE "CaptureFisheriesRecord"
      ADD CONSTRAINT "CaptureFisheriesRecord_recordedById_fkey"
      FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
