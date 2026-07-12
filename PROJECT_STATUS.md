# Project Status

## Completed Milestones

### M1: Production Foundation

- Initialized the Next.js App Router project with TypeScript strict mode.
- Configured Tailwind CSS v4 and shadcn/ui primitives.
- Added Better Auth foundation for email/password authentication.
- Added Drizzle ORM with Neon PostgreSQL configuration.
- Added i18n with Azerbaijani as default, plus English and Russian.
- Added environment validation, linting, formatting, tests, and core documentation.

### M2: Virtual Wardrobe Core

- Added protected wardrobe page.
- Added wardrobe database schema and migrations.
- Implemented clothing item create, read, update, and delete.
- Added image upload foundation with client-side compression.
- Added local development storage abstraction.
- Added manual wardrobe fields: name, category, clothing type, colors, season, style, material, brand, and notes.
- Added gallery, search, filters, loading states, empty states, and error handling.
- Added deletion queue preparation for future image/account cleanup.

### M3: AI Clothing Analysis

- Added analysis status lifecycle: pending, analyzing, done, failed.
- Added AI analysis fields for clothing type, category, colors, HEX colors, material, season, style, fit, pattern, warmth, formality, brand guess, confidence, visual description, prompt version, and model id.
- Added AI provider abstraction with development mock provider and production provider guardrails.
- Added analysis trigger/retry endpoints.
- Added user review and correction workflow where user corrections override AI values.
- Added Zod validation and tests for provider behavior and analysis validation.

### M3.5: Clothing Image Processing Experience

- Added immediate image preview with dimensions and file size.
- Added background-removal provider abstraction.
- Added development mock provider with production guardrails.
- Stored both original and processed image metadata.
- Added processing modal with upload, detection, background removal, optimization, and save steps.
- Prepared architecture for mirror selfie mode, outfit segmentation, and virtual try-on.

### M4: AI Personal Stylist v1

- Added outfit, outfit item, outfit request, outfit feedback, and outfit collection tables.
- Added stylist provider abstraction with development mock and production provider guardrails.
- Added chat-based outfit generation and quick request cards.
- Added wardrobe ranking/filtering before AI generation.
- Added ownership validation and hallucination prevention.
- Added outfit history, saved outfits, favorites, ratings, and feedback.
- Added insufficient wardrobe messaging.
- Added tests for ownership validation, outfit validation, hallucination prevention, and stylist provider behavior.

### M4.5: Premium UI/UX Experience

- Redesigned wardrobe upload into an AI-first flow.
- Added advanced manual mode for full-control uploads and edits.
- Automatically triggers existing AI analysis after new item creation.
- Improved processing modal with fullscreen blur, before/after preview, progress ring, and checklist.
- Improved wardrobe cards with processed images, premium hover treatment, AI confidence, visual tags, favorite UI, and status badges.
- Improved AI analysis UI with timeline, confidence, detected/corrected sections, and visual tags.
- Improved stylist UI with modern chat styling, polished quick actions, outfit result cards, explanation cards, confidence visualization, and alternatives carousel.
- Replaced static outfits placeholder with a saved outfits and outfit history experience.
- Added first-use onboarding explaining the Vestra workflow.

### M5: Subscription Architecture

- Added Free and Premium subscription plan architecture.
- Added subscription, usage, plan, and payment provider schema.
- Added feature flags, premium checks, usage limits, and 7-day trial support.
- Added payment provider abstraction for Stripe, Payriff, Epoint, and Manual flows.
- Added premium UI with upgrade banner, usage counters, premium badges, and trial status.
- Added subscription tests and documentation without enabling real payment processing.

### M5.5: Security, Admin Panel And Account System

- Added database-backed user roles: user, moderator, and admin.
- Added role helpers, route protection, and permission checks.
- Added user account page with profile, plan, trial, wardrobe, outfit, and AI usage statistics.
- Added account actions, logout, account deletion placeholder, and security section.
- Added forgot password and reset password foundation.
- Added email verification and account recovery database architecture.
- Added audit log and security event schema.
- Added development-safe request rate limiting for auth, AI, upload, and admin traffic.
- Added admin dashboard for users, subscriptions, system status, logs, and future store architecture.
- Added security, admin, and account documentation.

### M5.6: Real AI Clothing Analysis Quality Fix

- Made the real OpenAI-compatible clothing analysis provider the default path.
- Kept mock clothing analysis only for explicit `AI_PROVIDER=mock` mode and tests.
- Added browser-side deterministic garment color extraction during upload.
- Stored wardrobe image color hints for later analysis.
- Added field-level confidence scores and `needsReviewFields`.
- Improved the vision prompt for clothing type, category, colors, material, season, style, pattern, formality, and visible brand/logo detection.
- Added a quality enhancer for deterministic color, t-shirt/top category, and brand signals.
- Added a safe migration for existing wardrobe items.
- Added localized missing-credentials errors instead of fake analysis.
- Updated AI analysis documentation and tests.

### M6.1: Wear Tracking and Wardrobe Insights

- Added immutable `wear_log` and `wear_log_item` tables.
- Added authenticated APIs for creating, listing, and deleting wear logs.
- Added wardrobe insights API with 30, 60, 90 day, and all-time ranges.
- Added per-item wear summaries: last worn date, wear count, never-worn state,
  and long-unused status.
- Added `I wore this` actions for wardrobe items, saved outfits, and generated
  outfit results.
- Added wardrobe insights UI for utilization, used versus unused items, most
  worn items, never-worn items, long-unused items, recent activity, and category
  usage.
- Added browser timezone capture, idempotency keys, and duplicate-click
  protection.
- Added wear tracking documentation and deterministic tests.

### M6.2: Multi-Outfit Generation and Explicit Preference Learning

- Added outfit generation batches so one stylist request can return multiple
  candidates.
- Added style direction, season label, and formality label metadata on outfits.
- Added deterministic batch validation and candidate diversity filtering.
- Added structured feedback reason tags on outfit feedback.
- Added explicit stylist preference profile storage and edit UI.
- Added candidate cards for multiple outfit options on the stylist page.
- Added item replacement endpoint for same-role owned active alternatives.
- Preserved insufficient-wardrobe handling, hallucinated-ID checks, and M6.1
  wear tracking semantics.

### M6.3: Weather-Aware Outfit Planner

- Added weather provider abstraction with explicit mock and API modes.
- Added authenticated weather endpoint with cache/stale fallback behavior.
- Added outfit planning tables and APIs for date-based outfit planning.
- Added weather suitability rules without changing wear-log semantics.
- Added planner UI with today planning, weather context, and wardrobe-aware
  suggestions.

### M6.4: Production Integration Readiness

- Prepared weather provider diagnostics and documented the real-provider
  request/response contract.
- Prepared background-removal diagnostics and documented the production adapter
  contract.
- Updated the development mock background-removal provider so it no longer marks
  the original image as a successful processed result.
- Migrated deprecated Next.js `middleware.ts` behavior to `proxy.ts` while
  preserving auth, stylist, upload, and admin rate limits.
- Expanded environment and deployment production checklists for AI, weather,
  background removal, storage, database, and Better Auth credentials.

## Current Architecture

- Production-oriented monolith using Next.js App Router.
- Server components are used for protected route shells and metadata.
- Client components handle interactive wardrobe, stylist, and outfits experiences.
- API routes live under `app/api`.
- Domain modules live under `lib`.
- UI components live under `components`.
- Localized copy lives in `lib/i18n/dictionaries.ts`.
- Tests live in `__tests__`.
- SQL migrations live in `drizzle`.
- Request rate limiting for auth, stylist, wardrobe upload, and admin routes is
  handled through Next.js `proxy.ts`.

## Authentication

- Better Auth handles email/password authentication.
- Dashboard routes are protected through the dashboard layout.
- API routes check the authenticated session before accessing user-owned data.
- Better Auth trusted origins support localhost and local network testing while keeping production security separated.
- Auth-owned tables include `user`, `session`, `account`, and `verification`.
- The `user` table now includes a database-backed role field.
- Account recovery and email verification token tables are prepared for future email-provider integration.

## Database

- Runtime database is Neon PostgreSQL through `DATABASE_URL`.
- Drizzle ORM defines the schema in `lib/db/schema.ts`.
- Migrations are committed as SQL files and applied with `pnpm db:apply`.
- User-owned tables are scoped by `userId`.
- Implemented domain tables include:
  - `wardrobe_item`
  - `wardrobe_image_deletion_queue`
  - `outfit`
  - `outfit_item`
  - `outfit_request`
  - `outfit_feedback`
  - `outfit_collection`
  - `outfit_generation_batch`
  - `wear_log`
  - `wear_log_item`
  - `stylist_preference_profile`
  - `subscription`
  - `subscription_usage`
  - `subscription_plan`
  - `payment_provider`
  - `audit_log`
  - `security_event`
  - `account_recovery_token`
  - `email_verification_request`

## AI Systems

- Clothing analysis is isolated behind `lib/ai`.
- Background removal is isolated behind `lib/background-removal`.
- Personal stylist generation is isolated behind `lib/stylist`.
- Development providers are mock-only and blocked from production use where they
  could create fake production behavior.
- Production providers require real credentials.
- AI output is validated with Zod before use.
- Stylist output is validated to prevent hallucinated clothing IDs and cross-user item leakage.
- AI-generated values and user-corrected values are stored separately where needed.

## Storage

- Storage is abstracted behind `lib/storage`.
- Local development storage is supported.
- Production storage is intentionally credential-gated.
- Wardrobe items store original and processed image metadata.
- Image deletion queue exists for future cleanup workers and account deletion workflows.

## Current Bugs And Risks

- Favorite/status UI on wardrobe cards is currently UI-ready and not fully persisted as wardrobe item state.
- Laundry remains UI-ready, but wear frequency and long-unused status now come
  from immutable wear logs.
- The outfits page can display saved/history data, but deeper outfit management still belongs to future milestones.
- Production cloud storage adapter still needs final provider selection and verification.
- Real clothing analysis now requires AI credentials; live provider accuracy still needs visual QA with production models.
- Background removal mock does not perform real segmentation and now returns a
  synthetic transparent placeholder; production must use a real provider.
- Rate limiting is currently in-memory and must be moved to a distributed store before multi-instance production traffic.
- Account deletion cleanup queue exists, but the asynchronous deletion worker is not implemented.
- Forgot/reset password and email verification are architecture-ready, but real email delivery is not connected yet.
- Some product analytics and observability are not yet implemented.

## Next Steps

- M6.4 Production Integration Readiness is implemented with weather/background
  diagnostics, provider contracts, proxy migration, and production environment
  checklist updates.
- Decide the production storage provider.
- Decide and verify production background-removal/stylist providers.
- Run visual QA on real clothing analysis models with representative wardrobe images.
- Add production error monitoring and analytics.
- Add wardrobe lifecycle states as real persisted product features.
- Replace local rate limiting with a production distributed store.
