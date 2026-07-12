# Railway Deployment

Milestone 6.5A prepares Vestra for a Railway staging deployment using GitHub,
Neon PostgreSQL, Cloudflare R2, and the existing OpenRouter integration.

## Railway Settings

- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Start command: `pnpm start`
- Pre-deploy command: `pnpm db:apply`
- Healthcheck path: `/api/health`
- Restart policy: on failure
- Deployment source: GitHub repository

`pnpm start` uses `scripts/start-next.mjs`, which runs the standalone Next.js
server when available and binds to Railway's `PORT` on `0.0.0.0`.

## Required Variables

Core:

```env
DATABASE_URL=""
BETTER_AUTH_SECRET=""
BETTER_AUTH_URL=""
NEXT_PUBLIC_APP_URL=""
BETTER_AUTH_TRUSTED_ORIGINS=""
```

Storage:

```env
STORAGE_DRIVER="r2"
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_ENDPOINT=""
R2_REQUEST_TIMEOUT_MS="10000"
```

AI:

```env
AI_PROVIDER="openai-compatible"
AI_API_KEY=""
AI_API_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL_ID=""
OPENROUTER_HTTP_REFERER=""
```

Do not configure WeatherAPI, remove.bg, Resend, Sentry, payments, stores, or
catalog integrations for this milestone.

## Migrations

`pnpm db:apply` is the current safe Drizzle SQL application command. It should
run before the app starts in staging. Avoid running multiple concurrent staging
deployments against the same database while migrations are being applied.

## Staging Domain Process

1. Deploy from GitHub.
2. Let Railway generate the staging domain.
3. Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to the HTTPS Railway domain.
4. Set `BETTER_AUTH_TRUSTED_ORIGINS` only if additional HTTPS origins are needed.
5. Run `/api/health`.
6. Test sign-in, wardrobe upload, image rendering, and AI analysis.
