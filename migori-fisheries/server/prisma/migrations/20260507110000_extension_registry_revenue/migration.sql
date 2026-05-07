ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'MOTORIZED_BOAT';
ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'NON_MOTORIZED_BOAT';

DO $$
BEGIN
  CREATE TYPE "ExtensionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS "Inspection_entryCode_seq";

ALTER TABLE "Inspection"
  ADD COLUMN IF NOT EXISTS "entryCode" TEXT NOT NULL DEFAULT ('MIF-EXT-'::text || lpad((nextval('"Inspection_entryCode_seq"'::regclass))::text, 6, '0'::text)),
  ADD COLUMN IF NOT EXISTS "farmerNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" "Gender" NOT NULL DEFAULT 'MALE',
  ADD COLUMN IF NOT EXISTS "ageBracket" "AgeBracket" NOT NULL DEFAULT 'ADULT',
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "photos" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "approvalStatus" "ExtensionApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

DO $$
BEGIN
  ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_entryCode_key" UNIQUE ("entryCode");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Inspection_approvalStatus_idx" ON "Inspection"("approvalStatus");
