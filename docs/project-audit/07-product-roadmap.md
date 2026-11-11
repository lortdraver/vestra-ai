# 07 — Product Roadmap

Assumes one or two developers. Durations are rough engineering estimates, not commitments.

## Phase 0: Critical fixes (1–2 weeks). Do before Paddle Live or any marketing.

| #    | Item                                                                                                                                                   | Fixes         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| 0.1  | Rotate the Neon DB password; split databases (Neon branch for dev, separate prod); least-privilege app role; separate R2 bucket per env; fix `sslmode` | C5, C6        |
| 0.2  | Analysis timeout, reclaimable `analyzing` lease, and a repair script for the 12 stuck rows; retry button in the UI                                     | C1            |
| 0.3  | Enforce analysis and background-removal quotas with atomic `subscription_usage` writes; cap re-analysis per item                                       | C2            |
| 0.4  | Distributed rate limiter (Upstash/KV or Postgres) keyed on user ID; exclude `get-session` from the strict auth bucket                                  | C3            |
| 0.5  | Real account deletion (cascade plus R2 purge) and a deletion-queue worker (cron); data export endpoint                                                 | C4            |
| 0.6  | Record the real model ID and token usage from the provider response                                                                                    | H1            |
| 0.7  | Security headers; re-encode uploads with `sharp` (magic bytes, EXIF strip); `nosniff` on the image route                                               | H4, H5        |
| 0.8  | Remove or wire dead account buttons; persist favourites                                                                                                | UX trust      |
| 0.9  | GitHub Actions CI: typecheck, lint, test, build                                                                                                        | M1            |
| 0.10 | Error monitoring (Sentry or similar)                                                                                                                   | Observability |

## Phase 1: MVP hardening (3–5 weeks)

- **Background job pipeline** for upload processing and analysis (Inngest, Trigger.dev, or a Postgres queue). Uploads return in under 2 s with live status.
- **Presigned R2 URLs** for images instead of proxying every byte; use the Neon pooler / serverless driver.
- **Activation flow**: a "first 5 items to first outfit" checklist, plus a bulk upload of several photos at once.
- **AI eval harness** built from user corrections; choose the tagging model on evidence.
- Pagination on the wardrobe list; split the 2,800-line wardrobe client into components with a data layer (TanStack Query or server actions).
- Decide the hosting target (Vercel vs Railway) and document a single deploy path.
- Then go **Paddle Live**.

## Phase 2: Important next features, chosen for retention (1–3 months)

1. **Daily "today's outfit" with weather.** Push or email at a user-chosen time. This is the retention loop, and the parts (planner, weather, stylist) already exist.
2. **Conversational stylist mode.** Answer "how do I style these trousers?" with grounded, item-referenced answers, and keep short multi-turn context.
3. **Flat-lay outfit collages.** Composite the cut-outs into a shareable image. This is the brand's visual signature and a growth loop.
4. **Wardrobe analytics v2.** Cost-per-wear (add a price field), utilisation score, "never worn in 90 days" clean-out suggestions.
5. **Gap analysis** ("one pair of neutral trousers unlocks 14 new outfits"). This feeds the affiliate model described in `BUSINESS_MODEL.md`.
6. **Social sign-in** (Google, Apple) to cut sign-up friction.

## Phase 3: Advanced AI (3–6 months)

- Image embeddings in `pgvector`: similar items, duplicate detection, retrieval-based "what goes with this".
- Multi-item photo segmentation (one photo of a whole outfit or a mirror selfie → several items).
- Personalised ranking learned from feedback and wear logs (the data is already collected).
- Trip packing lists.
- **3D (premium, credit-based, opt-in)**, only after the pipeline exists and only if user research shows demand (see doc 05 §6).

## Phase 4: Long term

- Native mobile app, or a PWA first. The Flutter folders are empty. A PWA on the existing Next.js code is far cheaper than a rewrite. Consider React Native or Expo only once retention is proven.
- Virtual try-on.
- Resale and marketplace integrations for items flagged unused.
- Partner and brand analytics (aggregated and anonymised, with explicit consent).

## What to explicitly not do yet

- 3D generation, virtual try-on, a marketplace.
- More admin analytics. The current dashboard already exceeds what 26 users need.
- A native-app rewrite.
