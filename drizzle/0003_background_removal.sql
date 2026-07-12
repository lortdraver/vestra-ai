ALTER TABLE "wardrobe_item"
  ADD COLUMN IF NOT EXISTS "originalImageUrl" text,
  ADD COLUMN IF NOT EXISTS "originalImageStorageKey" text,
  ADD COLUMN IF NOT EXISTS "originalImageContentType" text,
  ADD COLUMN IF NOT EXISTS "originalImageSize" text,
  ADD COLUMN IF NOT EXISTS "processedImageUrl" text,
  ADD COLUMN IF NOT EXISTS "processedImageStorageKey" text,
  ADD COLUMN IF NOT EXISTS "processedImageContentType" text,
  ADD COLUMN IF NOT EXISTS "processedImageSize" text,
  ADD COLUMN IF NOT EXISTS "backgroundRemovalStatus" text DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "backgroundRemovalProvider" text,
  ADD COLUMN IF NOT EXISTS "backgroundRemovalModelId" text;

UPDATE "wardrobe_item"
SET
  "originalImageUrl" = COALESCE("originalImageUrl", "imageUrl"),
  "originalImageStorageKey" = COALESCE("originalImageStorageKey", "imageStorageKey"),
  "originalImageContentType" = COALESCE("originalImageContentType", "imageContentType"),
  "originalImageSize" = COALESCE("originalImageSize", "imageSize"),
  "processedImageUrl" = COALESCE("processedImageUrl", "imageUrl"),
  "processedImageStorageKey" = COALESCE("processedImageStorageKey", "imageStorageKey"),
  "processedImageContentType" = COALESCE("processedImageContentType", "imageContentType"),
  "processedImageSize" = COALESCE("processedImageSize", "imageSize"),
  "backgroundRemovalStatus" = COALESCE("backgroundRemovalStatus", 'done')
WHERE "originalImageUrl" IS NULL OR "processedImageUrl" IS NULL;

CREATE INDEX IF NOT EXISTS "wardrobe_item_background_removal_status_idx"
  ON "wardrobe_item" ("userId", "backgroundRemovalStatus");
