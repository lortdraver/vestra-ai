# 03 — Feature Audit

Legend: **Implemented** = works end-to-end with real backend and persistence. **Partial** = core works but with notable gaps. **UI-only** = visible but not wired. **Mocked** = fake data or provider. **Broken** = demonstrably fails. **Missing** = not present.

"Verified in DB" means confirmed with a read-only count query against the database in `.env.local` on 2026-11-11.

## Accounts and auth

| Feature                            | Status      | Evidence                                                                                                                                                                         |
| ---------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email/password sign-up and sign-in | Implemented | `lib/auth.ts`, `app/api/auth/[...all]/route.ts`; 26 users in DB                                                                                                                  |
| Email verification                 | Implemented | Better Auth `emailVerification`, Resend adapter, `requireVerifiedEmailSession` on upload, stylist and preferences                                                                |
| Password reset                     | Implemented | `sendResetPassword`, `revokeSessionsOnPasswordReset: true`, flow test passes                                                                                                     |
| Social login (Google/Apple)        | Missing     | Only `emailAndPassword` is configured                                                                                                                                            |
| Roles (user/moderator/admin)       | Implemented | `lib/roles`, `user.role`, `scripts/set-user-role.mjs`                                                                                                                            |
| Edit profile                       | **UI-only** | Button with no handler, `components/account/account-actions.tsx:22`                                                                                                              |
| Change language from account page  | **UI-only** | Button with no handler, same file. Language switching works elsewhere via `LanguageSwitcher`.                                                                                    |
| **Delete account**                 | **UI-only** | Destructive button with no handler, `account-actions.tsx:31`. Copy claims "Secure account deletion cascade… in place" (`dictionaries.ts:1250`), but no deletion endpoint exists. |

## Digital wardrobe

| Feature                                                   | Status      | Evidence                                                                                                                    |
| --------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Upload with client compression and colour hints           | Implemented | `lib/wardrobe/image-compression.ts`, upload route                                                                           |
| Browse, search and filter (category, season, style, text) | Implemented | `GET /api/wardrobe/items`. No pagination.                                                                                   |
| Edit item metadata                                        | Implemented | `PATCH /api/wardrobe/items/[id]`                                                                                            |
| Delete item (soft delete + image deletion queue)          | Partial     | Row is marked deleted and keys are queued. **The queue is never processed**: 30 rows `pending` in DB, and no worker exists. |
| Favourite wardrobe items                                  | **UI-only** | `favoriteItemIds` is local `useState` (`wardrobe-page-client.tsx:320`) and is lost on reload                                |
| Laundry status                                            | UI-only     | Derived label only, as acknowledged in `PROJECT_STATUS.md`                                                                  |
| Private image delivery                                    | Implemented | `app/api/wardrobe/images/[...key]/route.ts` checks ownership                                                                |
| Thumbnails                                                | Implemented | `lib/wardrobe/thumbnails.ts` plus backfill script                                                                           |

## Image processing

| Feature                                 | Status                  | Evidence                                                                                                                                                                                                                             |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Background removal (remove.bg)          | Implemented             | `lib/background-removal/removebg-provider.ts`; 71 items `removebg/done` in DB                                                                                                                                                        |
| Background removal, generic API adapter | Implemented, unverified | `api-provider.ts`; no evidence it is used                                                                                                                                                                                            |
| Mock background removal                 | Mocked, **mislabelled** | Mock returns the original image and the upload route records `backgroundRemovalStatus='done'`; 8 such rows in DB. This contradicts `PROJECT_STATUS.md` M6.4 ("no longer marks the original image as a successful processed result"). |
| Outfit or selfie segmentation, try-on   | Missing                 | Only "architecture prepared" in docs                                                                                                                                                                                                 |

## AI clothing recognition

| Feature                                                                                                                     | Status                  | Evidence                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vision analysis (role, subtype, colours, hex, material, season, style, fit, pattern, warmth, formality, brand, confidences) | Implemented             | `lib/ai/openai-compatible-provider.ts`, strict JSON schema plus Zod                                                                                  |
| User corrections that override AI                                                                                           | Implemented             | `PATCH .../analysis`, `userCorrections` JSONB                                                                                                        |
| Deterministic quality enhancer (colour, t-shirt, brand)                                                                     | Implemented             | `lib/ai/quality.ts`                                                                                                                                  |
| Retry after failure                                                                                                         | Implemented             | Status `failed` can be retried                                                                                                                       |
| **Recovery from an interrupted analysis**                                                                                   | **Broken**              | Claim query uses `ne(analysisStatus,'analyzing')` with no expiry. **12 of 79 items (15%) are stuck in `analyzing` in DB** and can never be re-run.   |
| Model provenance                                                                                                            | **Broken**              | `analysisModelId` stores the model's self-reported `modelId`. The DB holds 30+ invented values such as `wardrobe-vision-v1` and `gpt-4o-2024-08-06`. |
| Monthly analysis quota                                                                                                      | **Missing enforcement** | `ai_analyses_monthly` is defined in `lib/subscription/plans.ts` but never checked                                                                    |

## AI stylist and outfits

| Feature                                                                      | Status                     | Evidence                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat and quick-request outfit generation, 2–3 candidates                     | Implemented                | `app/api/stylist/generate/route.ts` (1,148 lines)                                                                                                                                   |
| Uses only owned items (anti-hallucination)                                   | Implemented                | `lib/stylist/validation.ts`, ownership checks, strict retry                                                                                                                         |
| Deterministic pre-ranking (colour, formality, season, weather, wear history) | Implemented                | `lib/stylist/scoring.ts`, `fashion-rules.ts`                                                                                                                                        |
| Styling rationale per item                                                   | Implemented                | `explanation` and `overallExplanation` fields                                                                                                                                       |
| Insufficient-wardrobe messaging                                              | Implemented                | `insufficient_wardrobe` status                                                                                                                                                      |
| Replace one item in an outfit                                                | Implemented                | `api/stylist/replace-item`                                                                                                                                                          |
| Explicit preferences and learned signals                                     | Implemented                | `stylist_preference_profile`, `deriveLearnedPreferenceSignals`                                                                                                                      |
| Save, favourite, rate, feedback tags, soft delete outfits                    | Implemented                | 94 outfits in DB                                                                                                                                                                    |
| "How do I style these trousers?" free-form Q&A                               | Partial                    | Requests always go to outfit generation. There is no conversational answer mode or multi-turn memory.                                                                               |
| Stylist quota                                                                | Implemented (inconsistent) | Enforced over a **rolling 7 days** (`entitlements.ts:31`) under a key named `stylist_requests_monthly`, with `period: 'month'` in `plans.ts:108`. The pricing copy says "per week". |

## Planner, weather, wear

| Feature                                                            | Status      | Evidence                                                                                                |
| ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------- |
| Weather (Open-Meteo plus geocoding)                                | Implemented | `lib/weather/open-meteo-provider.ts`. The local env uses `mock`; the production value was not verified. |
| Calendar planning, suitability and forecast-change warnings        | Implemented | `lib/planner/*`, `components/planner/*`                                                                 |
| Wear logging and insights (30/60/90 days, never-worn, long-unused) | Implemented | `lib/wear/*`; 20 wear logs in DB                                                                        |
| Trip packing, cost-per-wear                                        | Missing     | Mentioned only in business and roadmap docs                                                             |

## Monetisation, admin, compliance

| Feature                                                             | Status                | Evidence                                                                                                                                                                       |
| ------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paddle checkout, portal, cancel, resume, switch, webhooks           | Implemented (Sandbox) | `lib/billing/*`; Live cutover not done by design                                                                                                                               |
| Usage counters UI                                                   | Partial / misleading  | `subscription_usage` has **0 rows**. Analysis and background-removal meters read from it, so they only show real numbers where `usage-display.ts` backfills from other tables. |
| Background-removal quota                                            | Missing enforcement   | `background_removals_monthly` is never checked                                                                                                                                 |
| Admin analytics dashboard                                           | Implemented           | `/dashboard/admin`, 1,012-line `lib/analytics/admin.ts`                                                                                                                        |
| Consent manager, GA4 and Clarity gating, privacy/terms/refund pages | Implemented           | `components/privacy/*`, `lib/privacy/*`                                                                                                                                        |
| Data export (GDPR access)                                           | Missing               | —                                                                                                                                                                              |
| Account and data deletion (GDPR erasure)                            | Missing               | See above                                                                                                                                                                      |
| Error monitoring (Sentry or similar)                                | Missing               | Listed as a next step in `PROJECT_STATUS.md`                                                                                                                                   |
| Native mobile app                                                   | Missing               | The two Flutter folders are empty templates                                                                                                                                    |

## 3D clothing generation

| Feature                                   | Status                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Image-to-3D, GLB storage, Three.js viewer | **Missing entirely.** No code, dependency, table or env var references 3D. |
