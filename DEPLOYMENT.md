# Deployment

## Overview

Vestra is designed to deploy as a Next.js application with:

- GitHub for source control;
- Vercel for the web application;
- Neon PostgreSQL for the primary database;
- production object storage for wardrobe images;
- production AI providers for clothing analysis, background removal, and styling.

Railway can be used for future workers or supporting services.

## GitHub

Recommended setup:

- create a private GitHub repository;
- protect the main branch;
- require pull request review before merge;
- require checks before merge:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `pnpm format:check`
- store secrets only in deployment providers, never in Git;
- keep `.env.example` updated when environment variables change.

Suggested branch flow:

- `main` for production-ready code;
- `develop` or milestone branches for active work;
- `codex/*` for implementation branches.

## Vercel

Vercel should host the Next.js app.

Setup steps:

1. Import the GitHub repository into Vercel.
2. Select the project root.
3. Use the default Next.js framework preset.
4. Configure build command:

```bash
pnpm build
```

5. Configure install command:

```bash
pnpm install
```

6. Configure required environment variables.
7. Deploy preview environment.
8. Run production smoke tests.
9. Promote to production.

Important production settings:

- set `NODE_ENV=production`;
- set `NEXT_PUBLIC_APP_URL` to the production domain;
- set `BETTER_AUTH_URL` to the production domain;
- ensure Better Auth trusted origins include only approved production origins;
- do not use mock AI or mock background-removal providers in production.

## Railway

Railway is optional for the current app, but useful for background services.

Good future Railway services:

- image deletion worker;
- scheduled wardrobe insight generation;
- email/notification worker;
- partner inventory import worker;
- second-hand listing sync worker.

Railway should not be required for the first Vercel web deployment unless a worker is introduced.

## Neon PostgreSQL

Production database setup:

1. Create a Neon project.
2. Create production and preview branches as needed.
3. Copy the pooled production connection string into `DATABASE_URL`.
4. Apply migrations:

```bash
pnpm db:apply
```

5. Verify tables:
   - `user`
   - `session`
   - `account`
   - `verification`
   - `wardrobe_item`
   - `wardrobe_image_deletion_queue`
   - `outfit`
   - `outfit_item`
   - `outfit_request`
   - `outfit_feedback`
   - `outfit_collection`

Operational notes:

- never run destructive schema changes without a backup;
- review migrations before production apply;
- keep database URLs out of source control;
- ensure all user-owned queries remain scoped by `userId`.

## Domain

Recommended setup:

1. Buy the production domain.
2. Add the domain to Vercel.
3. Configure DNS records from Vercel.
4. Wait for SSL certificate provisioning.
5. Set:

```bash
NEXT_PUBLIC_APP_URL="https://your-domain.com"
BETTER_AUTH_URL="https://your-domain.com"
BETTER_AUTH_TRUSTED_ORIGINS="https://your-domain.com"
```

6. Test sign-up, sign-in, sign-out, uploads, and AI flows on the real domain.

For local network testing, keep LAN origins limited to local development configuration and out of production deployment settings.

## Production Environment Variables

Core:

```bash
DATABASE_URL=""
NEXT_PUBLIC_APP_URL=""
BETTER_AUTH_URL=""
BETTER_AUTH_SECRET=""
BETTER_AUTH_TRUSTED_ORIGINS=""
```

Storage:

```bash
STORAGE_DRIVER=""
STORAGE_PUBLIC_BASE_URL=""
```

AI clothing analysis:

```bash
AI_PROVIDER="openai-compatible"
AI_API_KEY=""
AI_API_BASE_URL=""
AI_MODEL_ID=""
OPENROUTER_HTTP_REFERER=""
```

Background removal:

```bash
BACKGROUND_REMOVAL_PROVIDER=""
BACKGROUND_REMOVAL_API_KEY=""
BACKGROUND_REMOVAL_API_URL=""
BACKGROUND_REMOVAL_MODEL_ID=""
BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS="15000"
```

Weather:

```bash
WEATHER_PROVIDER=""
WEATHER_API_KEY=""
WEATHER_API_BASE_URL=""
WEATHER_REQUEST_TIMEOUT_MS="7000"
WEATHER_CACHE_TTL_SECONDS="900"
```

Stylist:

```bash
STYLIST_AI_PROVIDER=""
STYLIST_AI_API_KEY=""
STYLIST_AI_API_URL=""
STYLIST_AI_MODEL_ID=""
```

## Production Checklist

Before launch:

- [ ] GitHub repository is private or intentionally public.
- [ ] Main branch is protected.
- [ ] Vercel project is connected.
- [ ] Production domain is configured.
- [ ] SSL is active.
- [ ] Neon production database is created.
- [ ] `pnpm db:apply` has been run against production.
- [ ] Better Auth production URL is correct.
- [ ] Better Auth secret is strong and private.
- [ ] Trusted origins are production-safe.
- [ ] Production storage provider is configured.
- [ ] Local file storage is not used for public deployment.
- [ ] Production AI clothing analysis provider is configured.
- [ ] `pnpm ai:diagnose:openrouter` succeeds with sanitized output.
- [ ] Production background-removal provider is configured.
- [ ] `pnpm background-removal:diagnose` succeeds with sanitized output.
- [ ] Production weather provider is configured.
- [ ] `pnpm weather:diagnose` succeeds with sanitized output.
- [ ] Production stylist provider is configured.
- [ ] Mock AI, weather, and background-removal providers are not used in production.
- [ ] Rate limiting is configured before public launch.
- [ ] Error monitoring is configured.
- [ ] Product analytics are configured.
- [ ] Privacy policy and terms are available.
- [ ] Account deletion policy is available.
- [ ] Upload flow is tested on desktop and mobile.
- [ ] Wardrobe CRUD is tested.
- [ ] AI analysis is tested.
- [ ] Stylist generation is tested.
- [ ] Saved outfits and history are tested.
- [ ] Azerbaijani, English, and Russian UI are tested.
- [ ] Local network testing settings are not present in production.

## Smoke Test

After deployment:

1. Open the production domain.
2. Create a new account.
3. Sign out and sign back in.
4. Upload a clothing image.
5. Confirm preview and processing experience.
6. Confirm item is saved in wardrobe.
7. Confirm original and processed images load.
8. Run AI analysis or confirm auto-analysis.
9. Correct an AI field and save.
10. Generate an outfit in the stylist.
11. Save and favorite the outfit.
12. Open the outfits page and confirm history.
13. Switch locale to Azerbaijani, English, and Russian.
14. Test on a phone browser.
15. Check server logs and error monitoring.

## Rollback

If production fails:

- use Vercel deployment rollback for app regressions;
- avoid rolling back database schema without a planned migration;
- disable production AI providers only if the UI handles provider errors safely;
- keep the app available for auth and wardrobe access whenever possible.
