# AI Clothing Analysis

## Scope

Milestone 3 analyzes wardrobe item images and stores structured clothing metadata. It does not generate outfits, chat with users, or implement subscriptions.

## Status Model

Each wardrobe item has `analysisStatus`:

- `pending` - item has not been analyzed.
- `analyzing` - an analysis request is in progress.
- `done` - structured AI metadata is available.
- `failed` - the last analysis attempt failed and can be retried.

## Stored Analysis Fields

Raw AI output is stored in `aiAnalysis` and validated with Zod:

- detected clothing type
- detected category
- colors
- dominant hex colors
- material
- season
- style
- fit
- pattern
- warmth level
- formality level
- brand guess
- confidence score
- field-level confidence scores
- needs review fields
- visual description
- prompt version
- model id

User review data is stored separately in `userCorrections`. Effective display values are raw AI values with corrections applied on top.

## Provider Architecture

The provider interface lives in `lib/ai/provider.ts`.

Available providers:

- `mock` - explicit local/test mode only. Blocked in production.
- `openai-compatible` - production-oriented HTTP adapter requiring `AI_API_KEY`, `AI_API_BASE_URL`, and `AI_MODEL_ID`.

No fake production behavior is allowed. If real AI environment variables are missing, analysis fails explicitly.

## M5.6 Quality Fix

Normal analysis now defaults to the real OpenAI-compatible provider. Mock analysis is only used when `AI_PROVIDER=mock` is set explicitly and the app is not running in production.

The upload flow also extracts deterministic browser-side color hints from the decoded clothing image. These hints are stored on the wardrobe item and used during analysis to reduce background-color mistakes. The sampler is center-weighted and ignores transparent or very light background pixels where possible.

Provider output is post-processed with deterministic quality rules:

- clothing type normalization, including t-shirt/tee detection
- top-category correction for shirts, t-shirts, polos, sweaters, hoodies, and similar tops
- color override from deterministic image color hints
- dominant HEX color override from deterministic image color hints
- visible brand text/logo hints such as Levi's, Nike, Adidas, Zara, and H&M
- low-confidence field detection via `needsReviewFields`

For a grey Levi's t-shirt, expected output is:

- clothing type: `t-shirt`
- category: `tops`
- color: grey/light grey
- brand guess: `Levi's` when visible in the image or name
- material: cotton or cotton blend
- style: casual
- season: spring, summer, autumn
- pattern: solid
- formality: low

## OpenRouter Diagnostics

OpenRouter requests are sent to:

```text
https://openrouter.ai/api/v1/chat/completions
```

Required headers:

- `Authorization: Bearer <AI_API_KEY>`
- `Content-Type: application/json`
- `HTTP-Referer: http://localhost:3000` by default, or
  `OPENROUTER_HTTP_REFERER` when explicitly configured
- `X-OpenRouter-Title: Vestra`

Local uploaded images are sent as server-generated `data:image/...;base64,...` URLs. Vestra refuses to send localhost or `/uploads/...` image URLs to OpenRouter.

Development logs include sanitized OpenRouter diagnostics:

- HTTP status
- mapped error code
- provider error message
- metadata/error type when present
- model id
- request URL

They never log the API key, Authorization header, full base64 image, or private user data.

Mapped OpenRouter statuses:

- `400` invalid request or unsupported payload
- `401` invalid API key
- `402` insufficient credits
- `403` forbidden/model restriction
- `404` model or endpoint not found
- `408` provider timeout
- `429` rate limit
- `502/503` provider unavailable

Run server-only sanitized connectivity checks with:

```bash
pnpm ai:diagnose:openrouter
```

## Endpoints

- `POST /api/wardrobe/items/:id/analysis` - trigger or retry analysis for an owned item.
- `PATCH /api/wardrobe/items/:id/analysis` - save user corrections for an already completed analysis.

All endpoints require a Better Auth session and scope item access by `userId`.
