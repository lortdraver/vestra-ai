# 10 — Technical Architecture Proposal

Principle: **evolve the current monolith; do not rewrite it.** The module boundaries, provider abstractions, schema and tests are sound. What is missing is the async, state and environment layer around them.

## Target architecture

```
                         ┌──────────────── Vercel (or Railway — pick one) ───────────────┐
 Browser / PWA ──HTTPS──▶│ Next.js 16 App Router                                         │
   │                     │  ├─ Server components (shells, auth gate)                     │
   │                     │  ├─ Route handlers  (thin: auth → validate → enqueue/query)   │
   │                     │  ├─ proxy.ts → distributed rate limiter (Upstash/KV)          │
   │                     │  └─ Security headers (CSP, HSTS, XFO, nosniff)                │
   │                     └───────┬───────────────┬───────────────────┬──────────────────┘
   │  presigned GET (5–15 min)   │               │ enqueue           │ SQL (pooled)
   ▼                             ▼               ▼                   ▼
 Cloudflare R2  ◀── PUT ─── Job runner (Inngest / Trigger.dev / PG queue + cron)   Neon Postgres
 (per-env bucket)            ├─ process_item: re-encode → bg-removal → thumb        ├─ prod / staging / dev branches
                             ├─ analyze_item: vision on thumb → aiAnalysis          ├─ app role (DML only) + migration role
                             ├─ purge_deleted: drain deletion queue                 ├─ subscription_usage (atomic metering)
                             ├─ delete_account: cascade + R2 purge                  ├─ ai_call_log (model, tokens, cost, ms)
                             └─ daily_outfit: weather + stylist → email/push        └─ (later) pgvector embeddings
                                        │
                                        ▼
                         OpenRouter (tagging model ≠ stylist model) · remove.bg · Open-Meteo · Resend · Paddle
                                        │
                         Sentry (errors) · structured logs · spend alerts
```

## Concrete changes, mapped to current files

| Concern          | Today                                                     | Proposed                                                                                                                                                                                          | Touch points                                                                                              |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Environments     | One DB and bucket shared by dev and deployed              | Neon branch per env; R2 bucket per env; `lib/env.ts` validates all required vars per env with Zod at boot                                                                                         | `lib/env.ts`, `.env.example`, deploy settings                                                             |
| DB connections   | `pg.Pool(max 10)` on the direct host                      | Neon pooled host (`-pooler`), or `@neondatabase/serverless` with the Drizzle `neon-serverless` driver                                                                                             | `lib/db/index.ts`                                                                                         |
| DB roles         | Owner role                                                | `vestra_app` (SELECT/INSERT/UPDATE/DELETE) and `vestra_migrate` (DDL); migrations run with the latter                                                                                             | `scripts/apply-drizzle-sql.mjs` (+ `pg_advisory_lock`)                                                    |
| Upload           | One synchronous request does everything                   | Request: validate → `sharp` re-encode (strip EXIF) → PUT original → insert row `processing` → enqueue. Worker does the rest, idempotently per step.                                               | `app/api/wardrobe/items/route.ts`, new `lib/jobs/*`                                                       |
| Analysis         | Client-started request, no timeout, permanent lock        | Job with 30 s timeout and retries; lease column `analysisStartedAt`; real `model` and usage from the provider response                                                                            | `analysis/route.ts`, `lib/ai/openai-compatible-provider.ts`                                               |
| Metering         | Plan limits defined, partly enforced                      | One `consumeUsage(userId, key)` with an atomic upsert, called at enqueue for analysis and background removal and at request for stylist; unify the period (calendar month or rolling, one choice) | `lib/subscription/entitlements.ts`, `subscription_usage` (add unique `(userId, featureKey, periodStart)`) |
| Rate limiting    | In-process `Map`                                          | `@upstash/ratelimit` (sliding window), keyed on `userId` when authenticated and on a trusted client IP (`request.ip` / platform header) otherwise                                                 | `proxy.ts`, `lib/security/rate-limit.ts`                                                                  |
| Locks / caches   | In-process (`stylist/concurrency.ts`, `weather/cache.ts`) | Same Redis store (lock with TTL) or a Postgres advisory lock; weather cache in Redis or a `weather_cache` table                                                                                   | those two files                                                                                           |
| Images           | Proxied and fully buffered through Node                   | Ownership check, then a 302 to a **presigned R2 URL** (TTL from the existing `R2_SIGNED_URL_TTL_SECONDS`), or return presigned URLs in the item DTO; images then load from the CDN                | `images/[...key]/route.ts`, `lib/storage/r2.ts` (add `presignGet`)                                        |
| Deletion / GDPR  | Queue never drained; no account delete                    | `purge_deleted` cron; `DELETE /api/account` → job; `GET /api/account/export` (JSON + image zip); add FK `wardrobe_item.userId → user.id ON DELETE CASCADE` after cleaning orphans                 | new routes, new migration                                                                                 |
| Observability    | `console.info` per stage                                  | Sentry SDK; structured logger with levels; `ai_call_log` table for cost and latency dashboards                                                                                                    | route handlers, `lib/ai`, `lib/stylist`                                                                   |
| Security headers | None                                                      | `headers()` in `next.config.mjs`: CSP (allow Paddle, GA4, Clarity only after consent), HSTS, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`                                               | `next.config.mjs`                                                                                         |
| Auth origins     | Hard-coded apex domain in production                      | Derive from env (`BETTER_AUTH_URL`, `VERCEL_URL` for previews), keep the explicit allowlist                                                                                                       | `lib/auth-origin.ts`                                                                                      |
| Frontend data    | `fetch` + `useState` in 1,000–2,800-line clients          | TanStack Query (or server actions + `useOptimistic`) and feature sub-components; pagination with cursor on `createdAt,id`                                                                         | `components/*/…-page-client.tsx`                                                                          |
| CI/CD            | None                                                      | GitHub Actions: install → typecheck → lint → test → build; DB migrations as a gated deploy step; preview deploy per PR on a Neon branch                                                           | `.github/workflows/ci.yml`                                                                                |

## Optional 3D module (when justified)

- Table `wardrobe_item_model3d(id, wardrobeItemId, userId, status, provider, providerJobId, glbStorageKey, costCents, createdAt)`.
- `lib/model3d/provider.ts` interface matching the existing provider pattern. Start with one vendor.
- A credit ledger in `subscription_usage` (`model3d_credits`).
- Viewer route `/dashboard/wardrobe/[id]/3d`, lazy-loading `<model-viewer>` or `@react-three/fiber`. GLB served by presigned URL.
- Zero impact on core wardrobe flows if disabled (feature flag).

## Migration order (safe, incremental)

1. Environment split and DB roles.
2. CI and Sentry.
3. Timeouts, leases and metering.
4. Rate limiter.
5. Job runner for upload and analysis.
6. Presigned images.
7. Deletion and export.
8. Frontend refactor as features are touched.

Each step ships on its own and is reversible.

## What not to change

- Better Auth, Drizzle, the Zod-first AI boundary, the provider abstraction pattern, the stylist's deterministic pre-ranking and ownership validation, the taxonomy module, Paddle integration and i18n. These are good decisions.
- Do not split into microservices. One Next.js app plus one job runner is right for this stage.
