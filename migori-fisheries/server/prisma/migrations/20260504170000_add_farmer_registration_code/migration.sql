CREATE SEQUENCE IF NOT EXISTS "Farmer_farmerCode_seq" START WITH 1;

ALTER TABLE "Farmer" ADD COLUMN IF NOT EXISTS "farmerCode" TEXT;

WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS row_num
  FROM "Farmer"
  WHERE "farmerCode" IS NULL
)
UPDATE "Farmer" AS farmer
SET "farmerCode" = 'MIF-FRM-' || LPAD(numbered.row_num::TEXT, 6, '0')
FROM numbered
WHERE farmer.id = numbered.id;

SELECT setval(
  '"Farmer_farmerCode_seq"',
  GREATEST((SELECT COUNT(*) FROM "Farmer"), 0) + 1,
  false
);

ALTER TABLE "Farmer"
  ALTER COLUMN "farmerCode" SET DEFAULT ('MIF-FRM-' || LPAD(nextval('"Farmer_farmerCode_seq"')::TEXT, 6, '0')),
  ALTER COLUMN "farmerCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Farmer_farmerCode_key" ON "Farmer"("farmerCode");
