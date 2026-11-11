# 02 — Codebase Architecture

## Technology stack (verified from `package.json`, `pnpm-lock.yaml`)

| Layer           | Technology                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.2.11 App Router, React 19, `output: 'standalone'` (`next.config.mjs`)                          |
| Language        | TypeScript 5.7.3, `strict: true`                                                                          |
| Styling         | Tailwind CSS v4, shadcn/ui primitives on `@base-ui/react`, `lucide-react` icons, Inter + Playfair Display |
| Auth            | Better Auth 1.6 (email/password, email verification, password reset)                                      |
| DB              | PostgreSQL on Neon, `pg` Pool + Drizzle ORM 0.45                                                          |
| Images          | `sharp` 0.35 (server thumbnails), browser canvas compression                                              |
| Storage         | Local filesystem (dev) or Cloudflare R2 via a hand-written AWS SigV4 client (`lib/storage/r2.ts`)         |
| AI              | OpenRouter, OpenAI-compatible `chat/completions` with `json_schema` falling back to `json_object`         |
| Other APIs      | remove.bg, Open-Meteo, Resend, Paddle Billing, GA4, Microsoft Clarity, Vercel Analytics                   |
| Validation      | Zod 4                                                                                                     |
| Tests           | Vitest 3: 29 files, 359 tests, all passing on 2026-11-11                                                  |
| Package manager | pnpm                                                                                                      |

## Directory structure (excluding `node_modules`, `.next`, `public/uploads`)

```
app/
  api/                 31 route handlers (see API list below)
  dashboard/           wardrobe, stylist, outfits, planner, account, subscription, admin (+ layout = auth gate)
  (public pages)       /, sign-in, sign-up, forgot/reset-password, verify-email, pricing, faq, support, privacy, terms, refund
components/            feature clients (wardrobe 2,845 lines, stylist 1,132, planner 819, admin 888), ui/ primitives
lib/                   domain modules: ai, background-removal, stylist, wardrobe, wear, weather, planner,
                       subscription, billing, payments, analytics, privacy, account, roles, security, storage, i18n, db
drizzle/               17 hand-applied SQL migrations (0000–0016), no drizzle-kit meta journal
scripts/               20 operational scripts (diagnostics, backfills, billing reconcile, R2 migration)
__tests__/             29 Vitest files
docs/                  24 feature docs + root MASTER_CONTEXT, PROJECT_STATUS, ROADMAP, VISION, BUSINESS_MODEL, DEPLOYMENT
proxy.ts               Next 16 "proxy" (formerly middleware): rate limiting only
```

## Backend

There is no separate backend. Business logic lives in `lib/*` and is called from route handlers in `app/api/*`. The pattern is consistent: get the session, check ownership with `userId`, validate input, call the domain module, then return JSON with stable error codes (`lib/api/errors.ts`).

### API endpoints (verified from the file tree)

| Area                     | Routes                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                     | `api/auth/[...all]` (Better Auth, with sign-in diagnostics wrapper), `api/account/{request-password-reset,reset-password,resend-verification}`                                          |
| Wardrobe                 | `api/wardrobe/items` (GET list, POST upload), `items/[id]` (GET/PATCH/DELETE), `items/[id]/analysis` (POST run, PATCH corrections), `images/[...key]` (private image proxy), `insights` |
| Stylist                  | `api/stylist/generate`, `outfits`, `outfits/[id]`, `outfits/[id]/feedback`, `feedback`, `preferences`, `replace-item`                                                                   |
| Planner / wear / weather | `api/outfit-plans`, `outfit-plans/[id]`, `api/wear-logs`, `wear-logs/[id]`, `api/weather`                                                                                               |
| Billing                  | `api/billing/paddle/{checkout,portal,cancel,resume,switch}`, `api/webhooks/paddle`                                                                                                      |
| Ops                      | `api/health`, `api/locale`                                                                                                                                                              |

## Frontend

- Server components handle route shells, auth gating (`app/dashboard/layout.tsx` redirects to `/sign-in`) and dictionary loading.
- Each feature page is one large `'use client'` component that holds all state in `useState` and talks to the API with raw `fetch`. There is no data-fetching library, no shared cache and no global store. For example, `components/wardrobe/wardrobe-page-client.tsx` has 31 `useState` hooks in 2,845 lines.
- Localised copy lives in `lib/i18n/dictionaries.ts` (2,119 lines), and also in several `*/copy.ts` files and inline in `components/app-header.tsx` (Russian strings as `\u` escapes).

## Database

The schema is in `lib/db/schema.ts` (866 lines). The live database has all 17 migrations applied; the last is `0016_billing_lifecycle.sql`.

| Domain               | Tables                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth          | `user` (+ `role`), `session`, `account`, `verification`                                                                                                   |
| Wardrobe             | `wardrobe_item` (image variants, AI analysis JSONB, user corrections JSONB, statuses), `wardrobe_image_deletion_queue`                                    |
| Stylist              | `outfit`, `outfit_item`, `outfit_request`, `outfit_feedback`, `outfit_collection`, `outfit_generation_batch`, `stylist_preference_profile`, `outfit_plan` |
| Wear                 | `wear_log`, `wear_log_item`                                                                                                                               |
| Billing              | `subscription`, `subscription_plan`, `subscription_usage`, `payment_provider`, `billing_transaction`, `billing_webhook_event`                             |
| Security / analytics | `audit_log`, `security_event`, `account_recovery_token`, `email_verification_request`, `analytics_event`                                                  |

Relationship notes:

- `session` and `account` cascade from `user`. `wear_log` has FKs. **`wardrobe_item.userId` has no FK** (the comment in `schema.ts` tells contributors not to add FKs), so deleting a user orphans their wardrobe rows and images.
- `subscription` has no unique constraint on `userId`, so several rows per user are possible. The code works around this with environment-aware row filtering.
- Many fields are JSONB arrays (`colors`, `seasons`, `styles`) queried with the `?` operator. There are no GIN indexes, which is acceptable at current scale.
- `imageSize` is stored as `text`.

Migrations are applied by the custom `scripts/apply-drizzle-sql.mjs`. It tracks applied files in `app_schema_migrations` and runs each in a transaction, which is good. It takes no advisory lock, so concurrent deploys can race. `drizzle-kit generate/migrate` scripts still exist in `package.json`, but there is no `drizzle/meta` journal, so they are misleading.

## Configuration and environments

- `.env.example` documents about 60 variables. `lib/env.ts` validates only `DATABASE_URL` and `BETTER_AUTH_SECRET`. Everything else is checked lazily where it is used, so a misconfigured deployment surfaces as runtime 500s instead of failing to boot.
- **Hosting target is ambiguous.** `DEPLOYMENT.md` says Vercel for production. `docs/RAILWAY_DEPLOYMENT.md` says Railway for staging. Commit `0ba3cb3` says "Fix sharp runtime on Vercel". `@vercel/analytics` is a dependency. The Vercel connector returned 403 for this account scope, so **the live deployment could not be verified.**
- There is no CI in the repo (no `.github/`), so the documented quality gates are manual.

## Strengths worth keeping

- Clear module boundaries, with a provider abstraction for every external service and explicit mock modes that throw in production.
- Strict TypeScript, Zod at every AI boundary, and stable error codes.
- Every user-data query filters by `userId`. The image proxy checks ownership before serving.
- Paddle webhook uses HMAC with `timingSafeEqual` plus idempotency on `eventId`.
- Many operational scripts that default to dry-run.
