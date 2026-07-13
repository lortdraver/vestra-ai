# AI Personal Stylist

## Scope

Milestone 4 introduces AI Personal Stylist v1. It creates outfits only from the
authenticated user's wardrobe items and stores generation history, saved outfits,
favorites, ratings, and feedback.

Subscriptions, payments, calendar planning, laundry, packing, and virtual try-on
remain out of scope.

## Data Model

Tables:

- `outfit_request` - stores the prompt, quick request, locale, filters, and
  missing wardrobe items.
- `outfit` - stores generated outfit metadata, explanations, confidence,
  alternatives, saved/favorite flags, and missing items.
- `outfit_item` - joins outfits to owned wardrobe items with role and
  item-level explanation.
- `outfit_feedback` - stores rating and optional feedback.
- `outfit_collection` - prepared grouping table for saved outfit collections.

## Safety Rules

- All wardrobe queries are scoped by `userId`.
- The provider receives only the authenticated user's ranked wardrobe items.
- Every returned clothing ID is validated against the scoped wardrobe set.
- Duplicate clothing IDs are rejected.
- Normal complete outfit requests require at least one top, one bottom, and one
  pair of shoes after clothing IDs are verified against the user's wardrobe.
- Explicit single-item requests, such as choosing shoes or suggesting only a top,
  may return one valid owned item.
- Incomplete provider results are retried once with the missing roles. If they
  remain incomplete, the API returns a structured non-success result and does not
  store an outfit.
- AI responses must use the selected locale.

## Provider Architecture

`lib/stylist` exposes a `StylistProvider`.

Providers:

- `mock` - development-only deterministic provider.
- `api` / `openai-compatible` - production provider. It reuses `AI_API_KEY`,
  `AI_API_BASE_URL`, and `AI_MODEL_ID` by default, with optional
  `STYLIST_AI_*` overrides.

Production cannot use the mock provider and never silently falls back to it.

The production model must be a text-capable OpenAI-compatible chat model that
supports JSON output. Vestra first requests strict `json_schema` output and, if
the configured model rejects structured output or returns recoverable malformed
JSON, retries once with `json_object`. The model must have enough context to
read the ranked wardrobe candidates and generate up to three complete outfit
candidates without inventing item IDs.

## Multi-Outfit Generation

Milestone 6.2 returns a batch of outfit candidates for normal requests. The
target is three candidates, with a configurable maximum of five for future use.
Each candidate is stored as a normal `outfit` row and grouped by
`outfit_generation_batch`.

Successful candidates must pass Zod schema validation, authenticated ownership
validation, active wardrobe item validation, hallucinated ID rejection, duplicate
item rejection, required-role validation for complete outfits, and deterministic
diversity checks.

If the wardrobe cannot support enough different combinations, Vestra returns
fewer valid candidates and marks the batch as limited variety rather than
inventing items.

## Candidate Diversity

The validation layer rejects exact duplicate item sets and filters candidates
with excessive item overlap when they also share the same style direction.
Normal complete-outfit candidates should differ in a major role when the
wardrobe has enough variety.

## Item Replacement

`POST /api/stylist/replace-item` replaces one item inside an owned outfit. The
replacement stays within the same normalized wardrobe role/category, excludes
the current item, and uses only active owned wardrobe items. If no replacement is
available, the API returns `insufficient_alternatives`.

## Batch APIs

- `POST /api/stylist/generate` returns `result.status = "success"` with
  `candidates`.
- `POST /api/stylist/replace-item` replaces one candidate item.
- `POST /api/stylist/feedback` stores structured explicit feedback.
- `GET /api/stylist/preferences` reads explicit user stylist preferences.
- `PATCH /api/stylist/preferences` updates explicit user stylist preferences.

## Environment

```bash
STYLIST_AI_PROVIDER="api"
AI_API_KEY=""
AI_API_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL_ID=""

# Optional overrides only when stylist generation should use separate
# credentials from clothing analysis.
STYLIST_AI_API_KEY=""
STYLIST_AI_API_URL=""
STYLIST_AI_MODEL_ID=""
```

For local development mock mode, set `STYLIST_AI_PROVIDER="mock"` explicitly.
Do not set this value in Vercel production.

## Applying Schema

Run:

```bash
pnpm db:apply
```

This applies `drizzle/0004_ai_personal_stylist.sql`.

## Weather-Aware Planning

Milestone 6.3 extends stylist generation with optional date/time, location,
occasion, wear-history mode, and normalized weather context. Deterministic
weather suitability rules run before AI generation, so the provider only sees
owned active wardrobe candidates that are suitable where possible.

Existing ownership, locked-item, diversity, hallucination prevention, and
insufficient-wardrobe validation remain in place.
