ALTER TABLE "outfit"
ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;

CREATE INDEX IF NOT EXISTS "outfit_user_active_created_at_idx"
ON "outfit" ("userId", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "outfit_user_saved_deleted_idx"
ON "outfit" ("userId", "isSaved", "deletedAt");
