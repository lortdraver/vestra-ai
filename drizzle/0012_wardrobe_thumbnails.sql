alter table "wardrobe_item"
  add column if not exists "thumbnailImageUrl" text,
  add column if not exists "thumbnailImageStorageKey" text,
  add column if not exists "thumbnailImageContentType" text,
  add column if not exists "thumbnailImageSize" text,
  add column if not exists "thumbnailImageWidth" integer,
  add column if not exists "thumbnailImageHeight" integer;
