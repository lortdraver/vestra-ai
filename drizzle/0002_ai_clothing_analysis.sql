ALTER TABLE "wardrobe_item"
  ADD COLUMN IF NOT EXISTS "analysisStatus" text DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "aiAnalysis" jsonb,
  ADD COLUMN IF NOT EXISTS "userCorrections" jsonb,
  ADD COLUMN IF NOT EXISTS "analysisError" text,
  ADD COLUMN IF NOT EXISTS "analysisPromptVersion" text,
  ADD COLUMN IF NOT EXISTS "analysisModelId" text,
  ADD COLUMN IF NOT EXISTS "analyzedAt" timestamp;

CREATE INDEX IF NOT EXISTS "wardrobe_item_analysis_status_idx" ON "wardrobe_item" ("userId", "analysisStatus");
