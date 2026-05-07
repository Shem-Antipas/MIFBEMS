DO $$ BEGIN
  CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgeBracket" AS ENUM ('YOUTH', 'ADULT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Farmer" ADD COLUMN IF NOT EXISTS "gender" "Gender";
ALTER TABLE "Farmer" ADD COLUMN IF NOT EXISTS "ageBracket" "AgeBracket";
