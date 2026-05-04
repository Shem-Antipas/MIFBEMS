ALTER TYPE "FarmerStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_ACTIVE';

ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'FISH_DEPOT';
ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'BOAT_OWNER';
ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'FISH_MOVEMENT_PERMIT';
ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'BOAT_LICENSE';
ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'NEW_BOARD_REGISTRATION';
ALTER TYPE "LicenseType" ADD VALUE IF NOT EXISTS 'ICE_PLANT';

ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'STALLED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectCategory') THEN
    CREATE TYPE "ProjectCategory" AS ENUM ('BLUE_ECONOMY', 'LAKEFRONT_DEVELOPMENT', 'AQUACULTURE_DEVELOPMENT');
  END IF;
END
$$;

CREATE SEQUENCE IF NOT EXISTS "BlueEconomyProject_projectCode_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "CaptureFisheriesRecord_captureCode_seq" START 1;

ALTER TABLE "Farmer"
  ADD COLUMN IF NOT EXISTS "idNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE "License"
  ALTER COLUMN "farmerId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "holderName" TEXT,
  ADD COLUMN IF NOT EXISTS "holderIdNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "holderPhoneNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "holderEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "subCounty" TEXT,
  ADD COLUMN IF NOT EXISTS "ward" TEXT,
  ADD COLUMN IF NOT EXISTS "beachName" TEXT,
  ADD COLUMN IF NOT EXISTS "market" TEXT,
  ADD COLUMN IF NOT EXISTS "amountLicensed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "licensedById" TEXT,
  ADD COLUMN IF NOT EXISTS "licensedByName" TEXT;

UPDATE "License" AS l
SET
  "holderName" = COALESCE(l."holderName", f."name"),
  "holderIdNumber" = COALESCE(l."holderIdNumber", f."idNumber"),
  "holderPhoneNumber" = COALESCE(l."holderPhoneNumber", f."phoneNumber"),
  "holderEmail" = COALESCE(l."holderEmail", f."email"),
  "subCounty" = COALESCE(l."subCounty", f."subCounty"),
  "ward" = COALESCE(l."ward", f."ward")
FROM "Farmer" AS f
WHERE l."farmerId" = f."id";

ALTER TABLE "CaptureFisheriesRecord"
  ADD COLUMN IF NOT EXISTS "captureCode" TEXT,
  ADD COLUMN IF NOT EXISTS "idNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "ward" TEXT NOT NULL DEFAULT 'Unspecified',
  ADD COLUMN IF NOT EXISTS "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "month" INTEGER,
  ADD COLUMN IF NOT EXISTS "year" INTEGER;

UPDATE "CaptureFisheriesRecord"
SET
  "captureCode" = COALESCE("captureCode", 'MIF-CAP-' || lpad(nextval('"CaptureFisheriesRecord_captureCode_seq"')::text, 6, '0')),
  "month" = COALESCE("month", EXTRACT(MONTH FROM "fishingDate")::integer),
  "year" = COALESCE("year", EXTRACT(YEAR FROM "fishingDate")::integer);

ALTER TABLE "CaptureFisheriesRecord"
  ALTER COLUMN "captureCode" SET NOT NULL,
  ALTER COLUMN "captureCode" SET DEFAULT ('MIF-CAP-'::text || lpad((nextval('"CaptureFisheriesRecord_captureCode_seq"'::regclass))::text, 6, '0'::text));

CREATE UNIQUE INDEX IF NOT EXISTS "CaptureFisheriesRecord_captureCode_key" ON "CaptureFisheriesRecord"("captureCode");

ALTER TABLE "BlueEconomyProject"
  ADD COLUMN IF NOT EXISTS "projectCode" TEXT,
  ADD COLUMN IF NOT EXISTS "category" "ProjectCategory" NOT NULL DEFAULT 'BLUE_ECONOMY',
  ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "ward" TEXT NOT NULL DEFAULT 'Unspecified',
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "responsibleOfficerId" TEXT,
  ADD COLUMN IF NOT EXISTS "responsibleOfficerName" TEXT;

UPDATE "BlueEconomyProject"
SET "projectCode" = COALESCE("projectCode", 'MIF-PRJ-' || lpad(nextval('"BlueEconomyProject_projectCode_seq"')::text, 6, '0'));

ALTER TABLE "BlueEconomyProject"
  ALTER COLUMN "projectCode" SET NOT NULL,
  ALTER COLUMN "projectCode" SET DEFAULT ('MIF-PRJ-'::text || lpad((nextval('"BlueEconomyProject_projectCode_seq"'::regclass))::text, 6, '0'::text));

CREATE UNIQUE INDEX IF NOT EXISTS "BlueEconomyProject_projectCode_key" ON "BlueEconomyProject"("projectCode");
