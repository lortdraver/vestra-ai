# Wardrobe Module

## Scope

The wardrobe module supports authenticated CRUD for clothing items, browser-side image compression, secure upload validation, gallery display, search, filters, empty/loading/error states, wear tracking, AI analysis integration, and image deletion queue preparation.

Stylist, planner, subscription, and account systems are separate modules and should not change wardrobe ownership rules.

## Data Model

Apply the wardrobe tables with:

```bash
pnpm db:apply
```

The command loads `.env.local`, connects to that `DATABASE_URL`, and applies the
checked-in SQL files from `drizzle/` in order. It is safe for existing auth data
and avoids the interactive `db:push` prompt that can appear when Drizzle detects
changes around Better Auth tables.

`wardrobe_item` stores one user-owned clothing item.

Important fields:

- `userId` - required ownership scope for every query.
- `name`, `category`, `clothingType` - required manual catalog fields.
- `colors`, `seasons`, `styles` - JSON arrays for flexible filtering and future AI metadata.
- `material`, `brand`, `notes` - optional manual enrichment.
- `imageUrl`, `imageStorageKey`, `imageContentType`, `imageSize` - compatibility display metadata pointing at the processed image.
- `originalImageUrl`, `originalImageStorageKey`, `originalImageContentType`, `originalImageSize` - uploaded source image metadata.
- `processedImageUrl`, `processedImageStorageKey`, `processedImageContentType`, `processedImageSize` - background-removed clothing image metadata.
- `thumbnailImageUrl`, `thumbnailImageStorageKey`, `thumbnailImageContentType`, `thumbnailImageSize`, `thumbnailImageWidth`, `thumbnailImageHeight` - lightweight grid thumbnail metadata.
- `backgroundRemovalStatus`, `backgroundRemovalProvider`, `backgroundRemovalModelId` - image processing metadata.
- `imageDeletionStatus`, `imageDeleteRequestedAt` - preparation for async image cleanup.
- `analysisStatus`, `aiAnalysis`, `userCorrections` - AI analysis state and review data.

`wardrobe_image_deletion_queue` records images that must be deleted after item deletion, image replacement, or future account deletion.

## API

- `GET /api/wardrobe/items` - list authenticated user's items with `search`, `category`, `season`, and `style` filters.
- `POST /api/wardrobe/items` - create an item with multipart form data and an image.
- `GET /api/wardrobe/items/:id` - view one owned item.
- `PATCH /api/wardrobe/items/:id` - update manual fields and optionally replace the image.
- `DELETE /api/wardrobe/items/:id` - delete the item and enqueue image cleanup.
- `POST /api/wardrobe/items/:id/analysis` - trigger or retry AI clothing analysis.
- `PATCH /api/wardrobe/items/:id/analysis` - save user corrections to AI output.

All endpoints require Better Auth session cookies and scope database access by `userId`.

## Storage

The app uses `ObjectStorage` from `lib/storage`.

Current drivers:

- `local` - development-only storage under `public/uploads`. It throws in production.
- `r2` - production storage through private Cloudflare R2 objects served by authenticated application routes.

Production deployment should use Cloudflare R2. Other providers can be added by implementing the same `ObjectStorage` interface without changing wardrobe UI or API contracts.

## Image Handling

The client previews selected images immediately, including dimensions and file
size, then compresses them to WebP with a maximum dimension of 1600px before
upload. The server still validates content type and size because browser-side
validation is never trusted.

Accepted server types:

- `image/jpeg`
- `image/png`
- `image/webp`

Maximum uploaded size:

- 2.5 MB after client compression.

## Thumbnails

Wardrobe cards request `thumbnailImageUrl` so grid views do not download full
master images. Original and processed master objects remain untouched for AI,
editing, item detail views, and future high-resolution experiences.

Thumbnail generation:

- runs after the processed image is available;
- falls back to the original display image when background removal fails;
- stores thumbnails under the existing storage variant layout:
  `wardrobe/{userId}/thumb/{uuid}.webp`;
- uses WebP, max dimension `480px`, quality `82`;
- preserves aspect ratio and alpha transparency;
- logs `THUMBNAIL_GENERATION_STARTED`, `THUMBNAIL_GENERATION_COMPLETED`, and
  `THUMBNAIL_GENERATION_FAILED` without image bytes, signed URLs, or secrets;
- never fails item creation by itself.

Backfill existing items:

```bash
pnpm wardrobe:thumbnails:backfill
pnpm wardrobe:thumbnails:backfill -- --limit=100
pnpm wardrobe:thumbnails:backfill -- --apply --limit=100
```

The command is dry-run by default, loads `.env.local`, skips existing reachable
thumbnails, never deletes master images, and is idempotent.
