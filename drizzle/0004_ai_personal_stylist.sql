CREATE TABLE IF NOT EXISTS "outfit_collection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "outfit_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "locale" text NOT NULL,
  "prompt" text NOT NULL,
  "quickRequest" text,
  "filters" jsonb NOT NULL,
  "status" text DEFAULT 'completed' NOT NULL,
  "missingItems" jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "outfit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "requestId" uuid,
  "collectionId" uuid,
  "title" text NOT NULL,
  "occasion" text DEFAULT '' NOT NULL,
  "overallExplanation" text NOT NULL,
  "confidenceScore" text NOT NULL,
  "alternativeSuggestions" jsonb NOT NULL,
  "missingItems" jsonb NOT NULL,
  "isSaved" boolean DEFAULT false NOT NULL,
  "isFavorite" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "outfit_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "outfitId" uuid NOT NULL,
  "wardrobeItemId" uuid NOT NULL,
  "role" text NOT NULL,
  "explanation" text NOT NULL,
  "position" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "outfit_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "outfitId" uuid NOT NULL,
  "rating" text NOT NULL,
  "comment" text DEFAULT '' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "outfit_collection_user_id_idx" ON "outfit_collection" ("userId");
CREATE INDEX IF NOT EXISTS "outfit_request_user_created_at_idx" ON "outfit_request" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "outfit_user_created_at_idx" ON "outfit" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "outfit_user_saved_idx" ON "outfit" ("userId", "isSaved");
CREATE INDEX IF NOT EXISTS "outfit_user_favorite_idx" ON "outfit" ("userId", "isFavorite");
CREATE INDEX IF NOT EXISTS "outfit_item_outfit_idx" ON "outfit_item" ("outfitId");
CREATE INDEX IF NOT EXISTS "outfit_item_wardrobe_item_idx" ON "outfit_item" ("wardrobeItemId");
CREATE INDEX IF NOT EXISTS "outfit_feedback_user_outfit_idx" ON "outfit_feedback" ("userId", "outfitId");
