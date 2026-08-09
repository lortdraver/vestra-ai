# Cloudflare R2 Storage

Milestone 6.5A adds a production storage adapter for Cloudflare R2 using the
S3-compatible API. R2 is intended for staging and production wardrobe images.

## Environment

```env
STORAGE_DRIVER="r2"
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_ENDPOINT=""
R2_PUBLIC_BASE_URL=""
R2_SIGNED_URL_TTL_SECONDS="900"
R2_REQUEST_TIMEOUT_MS="10000"
```

`R2_PUBLIC_BASE_URL` is optional. Vestra keeps the bucket private by default and
serves wardrobe images through authenticated application routes.

## Architecture

- Local storage remains available for explicit local development only.
- Production must use `STORAGE_DRIVER=r2`.
- Original, processed, and thumbnail wardrobe images keep separate storage keys.
- R2 credentials are server-only and must never be exposed to the browser.
- Database rows store stable storage keys and app proxy URLs, not expiring signed
  URLs.
- `/api/wardrobe/images/[...key]` verifies ownership before reading the object.
- Admin image access follows the existing admin permission helper.
- The app safely falls back to the original-compatible display URL when a
  processed image field is unavailable.
- Wardrobe grids request `thumbnailImageUrl`; item detail and AI/editing flows
  keep using master original/processed objects.
- Thumbnail objects use the existing private key layout:
  `wardrobe/{userId}/thumb/{uuid}.webp`.
- Image proxy responses are private and vary by session cookie:
  `Cache-Control: private, max-age=900, stale-while-revalidate=3600`.

## Diagnostics

Run only after manually configuring credentials:

```bash
pnpm storage:diagnose
```

The diagnostic checks selected driver, required configuration, bucket
connectivity, temporary upload, temporary read, temporary delete, and post-delete
non-existence. It prints booleans and status only, never secrets.

## Local Image Migration

Dry-run is the default:

```bash
pnpm storage:migrate:r2 --dry-run
pnpm storage:migrate:r2 -- --limit=25
pnpm storage:migrate:r2 -- --user-id=user_id
```

Apply mode requires an explicit flag:

```bash
pnpm storage:migrate:r2 -- --apply --limit=25
```

The migration:

- scans existing wardrobe image storage keys;
- uploads local `public/uploads/wardrobe/...` objects to R2;
- verifies each object exists in R2 before updating database URLs;
- updates database rows to use authenticated image proxy URLs;
- never deletes local files automatically;
- can be resumed because storage keys are stable.

## Thumbnail Backfill

Generate thumbnails for existing wardrobe items after applying
`drizzle/0012_wardrobe_thumbnails.sql`:

```bash
pnpm wardrobe:thumbnails:backfill
pnpm wardrobe:thumbnails:backfill -- --limit=100
pnpm wardrobe:thumbnails:backfill -- --apply --limit=100
```

The thumbnail backfill is dry-run by default, idempotent, and skips rows whose
thumbnail object already exists. It never deletes or rewrites original and
processed master objects.
