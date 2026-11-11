# 01 — Project Overview

Audit date: 2026-11-11. Auditor: Claude (read-only audit, no application code changed).

## Which codebase this audit covers

The brief describes the product as "Westra AI". On disk there are three candidate folders:

| Folder                                              | What it actually is                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `C:\Users\gusai\outfit_planner`                     | Untouched `flutter create` counter template (`lib/main.dart`, 122 lines, "Flutter Demo Home Page"). No product code. |
| `C:\Users\gusai\Desktop\outfitplanner`              | Another Flutter starter (with a `firebase.json`), ~20 non-platform files. No product code was found.                 |
| `C:\Users\gusai\Desktop\virtual-wardrobe-blueprint` | **The real product.** Next.js 16 app, 48 commits, git remote `github.com/lortdraver/vestra-ai`.                      |

The product is named **Vestra** everywhere in code, copy, commits and the production domain (`https://vestraapp.uk`, hard-coded in `lib/auth-origin.ts`). "Westra" appears nowhere. Decide on one name before any marketing spend. These docs use "Vestra".

## What Vestra actually does today

Vestra is a working web app: an AI digital wardrobe and stylist in Azerbaijani (default), English and Russian. Signed-in users can:

1. **Upload clothing photos.** The browser compresses the image and extracts colour hints. The server stores the original, removes the background (remove.bg in production), creates a WebP thumbnail with `sharp`, and saves the item (`app/api/wardrobe/items/route.ts`).
2. **Get AI clothing analysis.** After upload, the client starts `POST /api/wardrobe/items/[id]/analysis`. That sends the image as a base64 data URL to an OpenAI-compatible vision model through OpenRouter. The JSON that comes back is checked with Zod and stored in `wardrobe_item.aiAnalysis`. User corrections are stored separately in `userCorrections`.
3. **Browse and manage the wardrobe.** Search, filters, edit, soft delete, wear stats and insights.
4. **Generate outfits with an AI stylist.** A chat-style page (`/dashboard/stylist`) ranks the user's own items with deterministic rules (`lib/stylist/scoring.ts`, `fashion-rules.ts`), then asks the LLM for 2–3 candidates. Results are checked so they only use the user's own item IDs (hallucination guard), and one strict retry runs on validation failure.
5. **Save, rate and delete outfits, and log wear.** "I wore this" creates immutable wear logs. These feed insights such as never-worn and long-unused items.
6. **Plan outfits on a calendar with weather.** Open-Meteo forecasts, weather suitability warnings and forecast-change detection (`/dashboard/planner`).
7. **Subscribe to "Vestra Pro".** Paddle Billing at EUR 4.99/month or EUR 39.99/year, with webhooks, cancel, resume, switch and a portal. The code says production is still on Paddle **Sandbox**.
8. **Admin analytics.** A first-party event ledger, an admin dashboard, and GA4 and Clarity loaded only with consent.

## Main parts and how they connect

```
Browser (React 19 client components)
  └─ fetch → Next.js route handlers (app/api/*)        ← proxy.ts: in-memory rate limit
              ├─ Better Auth (lib/auth.ts) → Postgres session/user tables
              ├─ Domain modules (lib/wardrobe, lib/stylist, lib/planner, lib/wear, lib/subscription, lib/billing)
              ├─ Drizzle ORM + node-postgres Pool → Neon PostgreSQL
              ├─ Object storage (lib/storage: local FS | Cloudflare R2 via hand-written SigV4)
              ├─ remove.bg (lib/background-removal)
              ├─ OpenRouter chat/completions (lib/ai, lib/stylist)
              ├─ Open-Meteo (lib/weather)
              ├─ Resend email (lib/account/email-provider.ts)
              └─ Paddle Billing API + webhook (lib/billing)
```

Everything runs as one Next.js application. There is no separate backend, queue, worker or cron.

## Live data snapshot (read-only query, counts only)

The database configured in `.env.local` currently contains 26 users, 79 wardrobe items, 94 outfits, 20 wear logs, 3 subscriptions and 410 analytics events. 71 of the items were processed by remove.bg, so **this database also serves a deployed environment**, not only a local sandbox (see doc 04, finding C5).

## Honest one-paragraph summary

Vestra is much further along than a prototype. Wardrobe CRUD, the image pipeline, AI tagging, a constrained AI stylist, wear tracking, a weather planner, billing and consent are all real and backed by a database, and the codebase is typed, linted and covered by 359 passing unit tests. Its weaknesses are operational rather than missing features: AI jobs that get stuck forever, AI cost quotas that are defined but never enforced, rate limiting that does not work across instances, no account deletion, a shared development/production database, and no background job system. 3D is entirely absent.
