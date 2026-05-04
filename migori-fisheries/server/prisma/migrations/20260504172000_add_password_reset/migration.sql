ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "User_passwordResetTokenHash_idx" ON "User"("passwordResetTokenHash");
