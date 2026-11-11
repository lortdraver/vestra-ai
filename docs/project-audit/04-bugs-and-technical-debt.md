# 04 — Bugs, Security Issues and Technical Debt

Severity: **C** = critical (data loss, money, security or legal exposure now), **H** = high, **M** = medium, **L** = low.
Every item cites code. Items marked "DB" were confirmed with read-only queries on 2026-11-11.

## Critical

### C1. AI analyses get stuck forever (DB: 12/79 items)

- `app/api/wardrobe/items/[id]/analysis/route.ts` claims an item with `UPDATE … WHERE analysisStatus <> 'analyzing'`. If the function is killed after the claim (timeout, deploy, crash, closed tab on a short-lived instance), the row stays `analyzing` with no expiry. Every later attempt then returns 202 "duplicate skipped".
- This is made worse by `lib/ai/openai-compatible-provider.ts → requestAnalysis()`, which calls `fetch` **without an AbortController or timeout**. The stylist and background-removal providers both have timeouts; analysis does not.
- No route exports `maxDuration`.
- Fix: store `analysisStartedAt`, treat `analyzing` older than N minutes as reclaimable, add a 30–45 s timeout, and run a one-off repair to reset the 12 stuck rows.

### C2. AI cost quotas are defined but not enforced

- `lib/subscription/plans.ts` defines `ai_analyses_monthly` (Free 20) and `background_removals_monthly` (Free 20).
- `lib/subscription/entitlements.ts` only enforces wardrobe items, stylist, saved outfits and planner. Nothing writes `subscription_usage` (DB: 0 rows).
- The analysis POST can be repeated without limit on owned items, and it does not require a verified email. remove.bg (paid per image) runs on every upload, capped only by the 30/300 item limit, and deleting and re-uploading resets that.
- The only brake is the in-memory rate limiter (see C3), which does not hold across instances.

### C3. Rate limiting does not work in production

`proxy.ts` and `lib/security/rate-limit.ts`:

- Buckets live in a module-level `Map`, so each serverless instance or replica has its own. They also reset on every cold start.
- The client key is the **first** `x-forwarded-for` value, which a client can spoof on any host that appends rather than overwrites the header.
- The key includes the pathname, so limits are per path, not per client.
- `/api/auth/*` is capped at 10/min and includes Better Auth's `get-session` GETs. Users behind one NAT (university, office) can be wrongly throttled.
- The duplicate-generation guard `lib/stylist/concurrency.ts` and the weather cache `lib/weather/cache.ts` are also process-local.
- Fix: Upstash Redis, Vercel KV or a Postgres-backed limiter, keyed on user ID for authenticated routes.

### C4. No account deletion, and deleted images are never removed

- The delete button has no handler (`components/account/account-actions.tsx:31`), but the UI copy claims deletion is in place.
- `wardrobe_image_deletion_queue` is written but never consumed (DB: 30 `pending`). Private photos stay in R2 after users delete them.
- `wardrobe_item.userId` has no FK, so even a manual user delete leaves wardrobe rows behind.
- There is a public privacy policy (`app/privacy`) and the target market includes EU users (EUR pricing, Paddle). Not being able to erase data is a GDPR Art. 17 exposure.

### C5. Local development shares the deployed database, as the owner role

- `.env.local` points at a Neon database that holds 26 users and 71 items processed by remove.bg. The local env does not configure remove.bg, so those rows came from a deployed environment.
- The app connects as `neondb_owner`, the database owner, so any SQL injection or bad script can drop tables.
- `.env.local` also sets `STORAGE_DRIVER` **twice** (`local`, then `r2`), so local uploads go to the R2 bucket that is presumably shared too.
- The `sslmode` value in the URL is not a valid libpq mode. `node-postgres` happens to treat it as verify-full, but `psql` and other libpq tools will reject it. The likely intent was `verify-full`.
- Fix: a Neon branch per environment, a least-privilege app role, and a separate R2 bucket.

### C6. Credentials to rotate

During this audit my redaction filter failed and the full `DATABASE_URL` (with password) was printed in this assistant session's tool output. It was not sent anywhere else and is not written in these docs. **Rotate the Neon password** as a precaution. Also review who else has had a copy of `.env.local`, which holds live R2, OpenRouter and auth secrets in plain text.

## High

| #   | Issue                                       | Evidence                                                                                                                                                                                                                                                  | Impact                                                                                                                                                                      |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Model provenance is fabricated              | `analysisModelId: analysis.modelId`, where `modelId` is a field **the model fills in** (`openai-compatible-provider.ts` schema, `analysis-schema.ts:104`). DB has 30+ invented IDs.                                                                       | You cannot tell which model produced which tag, so you cannot evaluate quality or compare models. Use the configured `AI_MODEL_ID` and OpenRouter's response `model` field. |
| H2  | Heavy synchronous upload request            | Upload route does the original PUT, remove.bg (15 s timeout), processed PUT, a `sharp` thumbnail and the DB insert in one request. The client then starts analysis separately.                                                                            | Slow uploads (often 5–20 s), function-timeout risk, and no retry if the tab closes.                                                                                         |
| H3  | Orphaned objects on failure                 | If the DB insert fails after the R2 PUTs, the uploaded objects are never cleaned up (upload route, catch block).                                                                                                                                          | Storage leak, plus private photos with no owner record.                                                                                                                     |
| H4  | Upload content is not validated             | `validateImageFile` trusts the client-declared `file.type`. There is no magic-byte check, and the original is stored and served as uploaded, with the stored `Content-Type` and no `X-Content-Type-Options: nosniff`.                                     | Low-to-moderate stored-content risk. The fix is cheap: decode with `sharp` and re-encode before storing.                                                                    |
| H5  | No security headers                         | `next.config.mjs` sets no CSP, HSTS, `X-Frame-Options` or `Referrer-Policy`.                                                                                                                                                                              | Clickjacking, weaker XSS defence.                                                                                                                                           |
| H6  | Every image is streamed through Node        | `images/[...key]` does a session lookup, a role query, an ownership query, then an R2 GET **fully buffered into memory** (`r2.ts getObject → arrayBuffer`) for every thumbnail. `R2_SIGNED_URL_TTL_SECONDS` and `R2_PUBLIC_BASE_URL` are read but unused. | A wardrobe grid of 50 items means about 150 DB queries plus 50 function invocations. Use short-lived presigned URLs.                                                        |
| H7  | Serverless connection exhaustion            | `lib/db/index.ts` creates a `pg.Pool({max:10})` per instance against Neon's **direct** (non-pooler) host.                                                                                                                                                 | Under Vercel concurrency this hits connection limits. Use the `-pooler` host or `@neondatabase/serverless`.                                                                 |
| H8  | Admins can read every user's private photos | `images/[...key]` lets `canAccessAdmin` skip the ownership filter, and access is not audit-logged.                                                                                                                                                        | Privacy and trust issue. Disclose it, log it, or remove it.                                                                                                                 |
| H9  | Mock background removal reports success     | `mock-provider.ts` plus the upload route sets `done` (DB: 8 rows).                                                                                                                                                                                        | Bad data in the shared DB, and it contradicts the status doc.                                                                                                               |
| H10 | Preview deployments cannot sign in          | `lib/auth-origin.ts → getProductionAppOrigins()` only accepts exactly `https://vestraapp.uk` when `NODE_ENV=production`, which Vercel previews also use.                                                                                                  | Preview QA is blocked unless every preview URL is added to `BETTER_AUTH_TRUSTED_ORIGINS`.                                                                                   |

## Medium

- **M1 No CI.** There is no `.github/workflows`. The documented gates (`typecheck`, `lint`, `test`, `build`) are honour-system. They all passed locally on 2026-11-11 (359/359 tests; `build` was not run).
- **M2 Giant client components.** `wardrobe-page-client.tsx` (2,845 lines, 31 `useState`), `stylist-page-client.tsx` (1,132), and `api/stylist/generate/route.ts` (1,148). These are hard to review and test, and there is no data cache layer (raw `fetch` + `useState`).
- **M3 No pagination.** `GET /api/wardrobe/items` returns all items. Stylist generation `select *` loads the full wardrobe, including large JSONB, on every request.
- **M4 Full-resolution image sent to the LLM.** `getLocalImageDataUrl` base64-encodes `imageStorageKey`, the full processed PNG, even though a ~512 px thumbnail exists. Vision token cost is higher than it needs to be.
- **M5 Inconsistent quota period.** `stylist_requests_monthly` is enforced over 7 rolling days while usage meters assume a calendar month (`plans.ts:108`).
- **M6 Env validation is minimal.** `lib/env.ts` checks only 2 of about 60 variables. The `.env` loader regex in `drizzle.config.ts` and `apply-drizzle-sql.mjs` truncates any value that contains `#`.
- **M7 Migration tooling.** No advisory lock in `apply-drizzle-sql.mjs`. The `db:generate` and `db:migrate` scripts are misleading because there is no meta journal. Schema comments forbid FKs while some tables have them.
- **M8 Log volume.** The upload, stylist and auth routes log every stage in production with `console.info` (about 15 lines per upload). That is noisy and costly on hosted log drains, and there is no structured logger or monitoring.
- **M9 Paddle webhook has no timestamp tolerance.** `paddle-signature.ts` does not check `ts` age. Replays are mitigated by `eventId` idempotency.
- **M10 Prompt bias.** The analysis prompt has fixed few-shot examples ("Levi's tee", "Nike shorts"), which can bias brand guesses.
- **M11 Invalid IDs cause 500s.** Non-UUID `[id]` params reach Postgres and throw instead of returning 400 or 404.

## Low

- `public/uploads/` holds 48 local images (gitignored, but real user photos on a dev disk).
- Three empty Flutter projects add confusion (`outfit_planner`, `Desktop/outfitplanner`).
- The brand name differs between the brief ("Westra") and the product ("Vestra").
- `tsconfig.tsbuildinfo` sits in the repo root (ignored).
- `ilike` search does not escape `%` or `_` in user input.
- Russian copy in `app-header.tsx` is stored as `\u` escapes, which is hard to edit.

## Technical debt summary

The codebase is clean at the line level (strict types, lint-clean, tested). The debt is **architectural**: everything is synchronous in request handlers, all state is in-process (rate limits, locks, cache), there is no job queue, there is no per-environment isolation, and usage metering exists in the schema but is not wired. These must be fixed before scaling users or turning on Paddle Live.
