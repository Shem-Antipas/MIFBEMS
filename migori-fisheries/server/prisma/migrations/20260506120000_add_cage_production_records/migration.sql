CREATE SEQUENCE IF NOT EXISTS "CageProductionRecord_cageCode_seq" START WITH 1;

CREATE TABLE IF NOT EXISTS "CageProductionRecord" (
  "id" TEXT NOT NULL,
  "cageCode" TEXT NOT NULL DEFAULT ('MIF-CAGE-'::text || lpad((nextval('"CageProductionRecord_cageCode_seq"'::regclass))::text, 6, '0'::text)),
  "farmerUniqueId" TEXT NOT NULL,
  "farmerName" TEXT NOT NULL,
  "phoneNumber" TEXT,
  "idNumber" TEXT,
  "subCounty" TEXT NOT NULL,
  "ward" TEXT NOT NULL,
  "numberOfCages" INTEGER NOT NULL DEFAULT 0,
  "activeCages" INTEGER NOT NULL DEFAULT 0,
  "inactiveCages" INTEGER NOT NULL DEFAULT 0,
  "fingerlingsStocked" INTEGER NOT NULL DEFAULT 0,
  "quantityHarvestedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CageProductionRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CageProductionRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CageProductionRecord_cageCode_key" ON "CageProductionRecord"("cageCode");
CREATE INDEX IF NOT EXISTS "CageProductionRecord_subCounty_idx" ON "CageProductionRecord"("subCounty");
CREATE INDEX IF NOT EXISTS "CageProductionRecord_year_month_idx" ON "CageProductionRecord"("year", "month");
CREATE INDEX IF NOT EXISTS "CageProductionRecord_recordedById_idx" ON "CageProductionRecord"("recordedById");
