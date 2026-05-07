ALTER TABLE "Query"
  ADD COLUMN IF NOT EXISTS "replyById" TEXT,
  ADD COLUMN IF NOT EXISTS "replyByName" TEXT,
  ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);

ALTER TABLE "Advisory"
  ADD COLUMN IF NOT EXISTS "targetUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Query_replyById_idx" ON "Query"("replyById");
CREATE INDEX IF NOT EXISTS "Advisory_targetUserId_idx" ON "Advisory"("targetUserId");
