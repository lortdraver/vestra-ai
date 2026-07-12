CREATE TABLE IF NOT EXISTS "outfit_plan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "outfitId" uuid,
  "generationBatchId" uuid,
  "title" text NOT NULL,
  "occasion" text,
  "startAt" timestamp NOT NULL,
  "endAt" timestamp,
  "allDay" boolean DEFAULT false NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "locationName" text,
  "latitude" text,
  "longitude" text,
  "note" text,
  "status" text DEFAULT 'planned' NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "outfit_plan_user_start_at_idx"
  ON "outfit_plan" ("userId", "startAt");

CREATE INDEX IF NOT EXISTS "outfit_plan_user_status_idx"
  ON "outfit_plan" ("userId", "status");

CREATE INDEX IF NOT EXISTS "outfit_plan_user_outfit_idx"
  ON "outfit_plan" ("userId", "outfitId");

CREATE INDEX IF NOT EXISTS "outfit_plan_user_date_range_idx"
  ON "outfit_plan" ("userId", "startAt", "endAt");

CREATE INDEX IF NOT EXISTS "outfit_plan_generation_batch_idx"
  ON "outfit_plan" ("generationBatchId");
