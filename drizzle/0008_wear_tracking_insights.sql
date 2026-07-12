CREATE TABLE IF NOT EXISTS "wear_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "outfitId" uuid REFERENCES "outfit"("id") ON DELETE set null,
  "wornAt" timestamp NOT NULL,
  "source" text NOT NULL,
  "note" text,
  "idempotencyKey" text,
  "timezone" text NOT NULL DEFAULT 'UTC',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "wear_log_item" (
  "wearLogId" uuid NOT NULL REFERENCES "wear_log"("id") ON DELETE cascade,
  "wardrobeItemId" uuid NOT NULL REFERENCES "wardrobe_item"("id") ON DELETE cascade,
  "role" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "wear_log_user_worn_at_idx"
  ON "wear_log" ("userId", "wornAt");

CREATE INDEX IF NOT EXISTS "wear_log_user_outfit_idx"
  ON "wear_log" ("userId", "outfitId");

CREATE UNIQUE INDEX IF NOT EXISTS "wear_log_user_idempotency_idx"
  ON "wear_log" ("userId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "wear_log_item_wear_log_idx"
  ON "wear_log_item" ("wearLogId");

CREATE INDEX IF NOT EXISTS "wear_log_item_wardrobe_item_idx"
  ON "wear_log_item" ("wardrobeItemId");
