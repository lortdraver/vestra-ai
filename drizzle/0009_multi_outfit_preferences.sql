CREATE TABLE IF NOT EXISTS "outfit_generation_batch" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "requestId" uuid,
  "status" text DEFAULT 'completed' NOT NULL,
  "candidateCount" integer DEFAULT 0 NOT NULL,
  "providerRequestCount" integer DEFAULT 1 NOT NULL,
  "retryCount" integer DEFAULT 0 NOT NULL,
  "durationMs" integer DEFAULT 0 NOT NULL,
  "modelId" text,
  "promptVersion" text DEFAULT 'stylist-batch-v1' NOT NULL,
  "schemaVersion" text DEFAULT 'stylist-batch-v1' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "outfit"
  ADD COLUMN IF NOT EXISTS "generationBatchId" uuid,
  ADD COLUMN IF NOT EXISTS "styleDirection" text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "seasonLabel" text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "formalityLabel" text DEFAULT '' NOT NULL;

ALTER TABLE "outfit_feedback"
  ADD COLUMN IF NOT EXISTS "generationBatchId" uuid,
  ADD COLUMN IF NOT EXISTS "reasonTags" jsonb DEFAULT '[]'::jsonb NOT NULL;

CREATE TABLE IF NOT EXISTS "stylist_preference_profile" (
  "userId" text PRIMARY KEY NOT NULL,
  "preferredStyles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "dislikedStyles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "preferredColors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "avoidedColors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "preferredFormality" text DEFAULT '' NOT NULL,
  "preferredFit" text DEFAULT '' NOT NULL,
  "preferredWardrobeItemIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "dislikedWardrobeItemIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "outfit_generation_batch_user_created_at_idx"
  ON "outfit_generation_batch" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "outfit_generation_batch_request_idx"
  ON "outfit_generation_batch" ("requestId");

CREATE INDEX IF NOT EXISTS "outfit_user_batch_idx"
  ON "outfit" ("userId", "generationBatchId");

CREATE INDEX IF NOT EXISTS "outfit_feedback_user_batch_idx"
  ON "outfit_feedback" ("userId", "generationBatchId");

CREATE INDEX IF NOT EXISTS "stylist_preference_profile_updated_at_idx"
  ON "stylist_preference_profile" ("updatedAt");
