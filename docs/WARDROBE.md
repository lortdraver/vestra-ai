# Wardrobe Module

## Scope

Milestone 2 implements the virtual wardrobe core only. It supports authenticated CRUD for clothing items, browser-side image compression, secure upload validation, gallery display, search, filters, empty/loading/error states, and image deletion queue preparation.

Outfit generation, subscriptions, and cloud storage provider integration are intentionally excluded.

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

Current driver:

- `local` - development-only storage under `public/uploads`. It throws in production.

Production deployment must provide a real storage adapter before uploads are enabled. Vercel Blob can be added by implementing the same interface without changing wardrobe UI or API contracts.

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
