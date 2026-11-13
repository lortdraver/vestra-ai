# Vestra Project Audit: Index and Executive Summary

Read-only audit performed 2026-11-11. No application code, schema or dependency was changed; only this folder was added. Database access was limited to read-only `SELECT count(*)`-style queries.

| Doc                                                                            | Topic                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [01-project-overview.md](01-project-overview.md)                               | What the product actually is and does                       |
| [02-codebase-architecture.md](02-codebase-architecture.md)                     | Stack, structure, API, DB                                   |
| [03-feature-audit.md](03-feature-audit.md)                                     | Implemented / partial / UI-only / mocked / broken / missing |
| [04-bugs-and-technical-debt.md](04-bugs-and-technical-debt.md)                 | Bugs, security, debt (with severity)                        |
| [05-ai-architecture.md](05-ai-architecture.md)                                 | AI pipeline today, proposal, 3D evaluation                  |
| [06-ux-ui-review.md](06-ux-ui-review.md)                                       | UX, design, mobile, a11y                                    |
| [07-product-roadmap.md](07-product-roadmap.md)                                 | Phased roadmap                                              |
| [08-competitive-analysis.md](08-competitive-analysis.md)                       | Competitors and differentiation                             |
| [09-prioritized-recommendations.md](09-prioritized-recommendations.md)         | Ranked recommendations                                      |
| [10-technical-architecture-proposal.md](10-technical-architecture-proposal.md) | Target architecture                                         |

## Executive summary

**1. What is it?** Vestra ("Westra" in the brief, but "Vestra" throughout the code and on vestraapp.uk) is a Next.js 16 / Postgres web app. It digitises a wardrobe from photos, tags items with a vision LLM, generates grounded outfits from owned items, tracks wear and plans outfits around the weather. It ships in AZ, EN and RU, with Paddle subscriptions in Sandbox. The `outfit_planner` Flutter folder is an empty template.

**2. What works?** Auth with verification and reset; wardrobe CRUD; remove.bg background removal; thumbnails; AI tagging with user corrections; an AI stylist that cannot invent items; saved and rated outfits; wear logs and insights; the weather planner; Paddle billing flows; consent and analytics; the admin dashboard. Typecheck and lint are clean and 359/359 tests pass. The live DB has 26 users and 79 items.

**3. What is incomplete?** Account deletion (UI-only), profile editing, persisted favourites, a deletion worker, quota enforcement for AI analysis and background removal, usage metering, data export, conversational stylist Q&A, CI, monitoring, mobile app and 3D (absent).

**4. What is technically wrong?**

- 15% of items are stuck "analysing" forever (no timeout, no lease expiry).
- Stored model IDs are invented by the model.
- Rate limits, locks and caches are in-memory.
- Every image is proxied and fully buffered through Node.
- Mock background removal records success.
- Heavy work runs synchronously in request handlers.
- Non-pooled DB connections run on serverless.

**5. Biggest risks.**

- Local development shares the deployed database (as owner) and the R2 bucket.
- No GDPR erasure despite a privacy policy and EU billing.
- Unmetered AI and remove.bg spend.
- Rotate the Neon password; it was exposed in this audit session's tool output.

**6. Fix immediately.** Recommendations 1–9 in doc 09: environment split and password rotation; stuck-analysis fix; quota enforcement; real model provenance; distributed rate limiting; account deletion and purge worker; security headers and upload re-encoding; dead UI; CI.

**7. Build next.**

- A background job pipeline. It unlocks fast uploads, reliable AI and metering.
- Presigned images.
- An AI eval harness built from user corrections.
- An activation checklist and bulk upload.
- Then the retention loop: a daily "today's outfit" with weather, flat-lay collages, and a conversational stylist.

**8. Recommended architecture.** Keep the Next.js monolith. Add a job runner, a Redis-class store for limits and locks, per-environment Neon branches and R2 buckets, presigned R2 delivery, Sentry and CI (doc 10). No microservices, no rewrite.

**9. How close to a usable MVP?** **Close: roughly 2–4 weeks of focused work** on Phase 0 plus part of Phase 1. The feature set already exceeds a typical MVP. Reliability, cost control and compliance are what is missing.

**10. Realistic path to a production startup.**

- Harden (Phase 0).
- Make onboarding fast, using async processing and bulk upload.
- Launch Paddle Live to a small AZ-first cohort.
- Measure activation (first outfit within 24 h) and week-4 retention.
- Build the daily-outfit loop.
- Only then expand features or markets.

The defensible edge is the AZ/RU localisation plus the personalisation data Vestra already collects. 3D and try-on come after product–market fit.

## Product and business notes

- **Problem.** "What do I wear, and what do I actually own?" is real and recurring. The strongest value is _daily decisions and buying less_, which `BUSINESS_MODEL.md` already states well.
- **Value proposition clarity.** The landing page is text-only. Show cut-outs and generated outfits.
- **Retention drivers.** A daily outfit plus weather, wear insights ("you haven't worn this in 90 days") and planner reminders.
- **Unnecessary now.** 3D, try-on, marketplace, more admin analytics, a native rewrite.
- **Monetisation.** The current Free/Pro split (EUR 4.99/month, EUR 39.99/year) is reasonable. Keep the free tier generous on wardrobe size, because the closet is the moat. Charge for AI volume, the daily stylist, advanced insights, and later 3D/try-on credits. Affiliate gap-filling is viable later, if clearly labelled. Do not turn on Live billing until quotas are enforced and deletion works.
