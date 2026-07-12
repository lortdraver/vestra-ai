CREATE TABLE IF NOT EXISTS "wardrobe_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "clothingType" text NOT NULL,
  "colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "seasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "styles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "material" text DEFAULT '' NOT NULL,
  "brand" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "imageUrl" text NOT NULL,
  "imageStorageKey" text NOT NULL,
  "imageContentType" text NOT NULL,
  "imageSize" text NOT NULL,
  "imageDeletionStatus" text DEFAULT 'active' NOT NULL,
  "imageDeleteRequestedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "wardrobe_image_deletion_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "wardrobeItemId" uuid,
  "storageKey" text NOT NULL,
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "requestedAt" timestamp DEFAULT now() NOT NULL,
  "processedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "wardrobe_item_user_id_idx" ON "wardrobe_item" ("userId");
CREATE INDEX IF NOT EXISTS "wardrobe_item_user_created_at_idx" ON "wardrobe_item" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "wardrobe_item_category_idx" ON "wardrobe_item" ("userId", "category");
CREATE INDEX IF NOT EXISTS "wardrobe_item_clothing_type_idx" ON "wardrobe_item" ("userId", "clothingType");
CREATE INDEX IF NOT EXISTS "wardrobe_image_deletion_queue_user_status_idx" ON "wardrobe_image_deletion_queue" ("userId", "status");
CREATE INDEX IF NOT EXISTS "wardrobe_image_deletion_queue_storage_key_idx" ON "wardrobe_image_deletion_queue" ("storageKey");
