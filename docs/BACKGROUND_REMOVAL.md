# Background Removal

## Scope

Milestone 3.5 adds the clothing image processing experience. Wardrobe creation
now stores the uploaded original image and a processed image intended for
transparent-background clothing display.

The feature does not add AI styling, subscriptions, outfit generation, or virtual
try-on. It prepares the architecture for those later workflows.

## Providers

`lib/background-removal` exposes a `BackgroundRemovalProvider` interface.

Current providers:

- `mock` - development-only provider. It returns the original uploaded image
  unchanged so development can exercise the processing pipeline without fake
  segmentation.
- `api` - production adapter. It requires real credentials and sends the image to
  a configured background-removal API.
- `removebg` - production remove.bg adapter. It uses `X-Api-Key` authentication
  and the remove.bg multipart contract.

Production must not use the mock provider. The provider selector throws when
`BACKGROUND_REMOVAL_PROVIDER=mock` is used in production.

## Environment

```bash
BACKGROUND_REMOVAL_PROVIDER="mock"
BACKGROUND_REMOVAL_API_KEY=""
BACKGROUND_REMOVAL_API_URL=""
BACKGROUND_REMOVAL_MODEL_ID=""
BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS="15000"
BACKGROUND_REMOVAL_SIZE="auto"
```

Use `BACKGROUND_REMOVAL_PROVIDER=api` with real credentials before deploying
background removal to production users.

Run a server-only sanitized connectivity check with:

```bash
pnpm background-removal:diagnose
```

The diagnostic reports provider mode, whether credentials are present, the
endpoint without query secrets, model id, HTTP status, response content type, and
a short provider message. It never prints the API key or image contents.

## Production API Contract

The `api` provider sends a `multipart/form-data` request:

- `image` - uploaded clothing image file.
- `mode` - currently `single_item`.
- `modelId` - configured model id.

Headers:

- `Authorization: Bearer BACKGROUND_REMOVAL_API_KEY`
- `Accept: image/png, application/json`

Supported successful responses:

- binary image response, preferably `image/png` with transparent background;
- JSON response with `imageBase64` and optional `contentType`;
- JSON response with `imageUrl` and optional `contentType`.

The provider converts the result into a `File`, stores it as the processed image,
and records provider/model metadata on `wardrobe_item`.

The API must return an actual processed image with the clothing item isolated on
a transparent background. The original upload is stored separately and must not
be treated as a successful processed result.

## remove.bg Contract

Use:

```env
BACKGROUND_REMOVAL_PROVIDER="removebg"
BACKGROUND_REMOVAL_API_KEY=""
BACKGROUND_REMOVAL_API_URL="https://api.remove.bg/v1.0/removebg"
BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS="15000"
BACKGROUND_REMOVAL_SIZE="auto"
```

The remove.bg adapter sends:

- `POST https://api.remove.bg/v1.0/removebg`
- multipart field `image_file`
- multipart field `size`
- header `X-Api-Key: <BACKGROUND_REMOVAL_API_KEY>`
- no `Authorization: Bearer` header

Successful responses must be binary images with transparent background. If
remove.bg fails after the original image is stored, Vestra keeps the wardrobe
creation successful, stores the original image as the display image, marks
`backgroundRemovalStatus=failed`, and allows the user to retry later.

Production background removal is considered configured only when:

- `BACKGROUND_REMOVAL_PROVIDER=api`;
- `BACKGROUND_REMOVAL_API_KEY` is set;
- `BACKGROUND_REMOVAL_API_URL` is set;
- the configured API returns an actual transparent-background clothing image.

If the provider is missing or unavailable, the upload flow must fail truthfully
instead of marking the original image as processed. Wardrobe cards prefer
`processedImageUrl` when present and fall back to the original-compatible
display URL for legacy or failed rows.

## Storage Model

The wardrobe item keeps legacy display fields for compatibility:

- `imageUrl`
- `imageStorageKey`
- `imageContentType`
- `imageSize`

These continue to point to the processed image.

New explicit image fields:

- `originalImageUrl`
- `originalImageStorageKey`
- `originalImageContentType`
- `originalImageSize`
- `processedImageUrl`
- `processedImageStorageKey`
- `processedImageContentType`
- `processedImageSize`
- `backgroundRemovalStatus`
- `backgroundRemovalProvider`
- `backgroundRemovalModelId`

Image replacement and deletion enqueue both original and processed storage keys
for future cleanup.

## Future Modes

The provider input includes a mode field so later milestones can add:

- mirror selfie mode
- full outfit segmentation
- virtual try-on

The current wardrobe create flow uses `single_item`.

## Applying Schema

Run:

```bash
pnpm db:apply
```

This applies `drizzle/0003_background_removal.sql` and backfills existing items
so old wardrobe rows continue to display through the processed image fields.
