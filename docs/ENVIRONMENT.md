# Environment

## Required Variables

- `DATABASE_URL` - Neon PostgreSQL connection string. Use a pooled SSL connection for production.
- `BETTER_AUTH_SECRET` - random secret with at least 32 bytes of entropy.
- `BETTER_AUTH_URL` - canonical app URL used by Better Auth.
- `BETTER_AUTH_TRUSTED_ORIGINS` - optional comma-separated local development
  origins, for example `http://192.168.100.8:3000`.
- `STORAGE_DRIVER` - object storage adapter. Use `local` only for development.
- `R2_ACCOUNT_ID` - Cloudflare account id for R2.
- `R2_ACCESS_KEY_ID` - server-only R2 access key id.
- `R2_SECRET_ACCESS_KEY` - server-only R2 secret access key.
- `R2_BUCKET_NAME` - private R2 bucket for wardrobe images.
- `R2_ENDPOINT` - S3-compatible R2 endpoint.
- `R2_PUBLIC_BASE_URL` - optional public base URL; not required for private delivery.
- `R2_SIGNED_URL_TTL_SECONDS` - reserved signed URL TTL setting.
- `R2_REQUEST_TIMEOUT_MS` - timeout for R2 API calls.
- `AI_PROVIDER` - `openai-compatible` for real clothing analysis. Use `mock`
  only for tests or explicit local mock mode.
- `AI_API_KEY` - required when `AI_PROVIDER=openai-compatible`.
- `AI_API_BASE_URL` - required OpenAI-compatible base URL. For OpenRouter use
  `https://openrouter.ai/api/v1`; Vestra sends requests to
  `https://openrouter.ai/api/v1/chat/completions`.
- `AI_MODEL_ID` - required model identifier for analysis.
- `OPENROUTER_HTTP_REFERER` - optional OpenRouter referer override. Defaults to
  `http://localhost:3000`.
- `STYLIST_AI_PROVIDER` - stylist provider selector. Use `api` or
  `openai-compatible` for production. Use `mock` only for explicit local
  development.
- `STYLIST_AI_API_KEY` - optional stylist-specific API key override. When empty,
  Vestra reuses `AI_API_KEY`.
- `STYLIST_AI_API_URL` - optional stylist-specific OpenAI-compatible base URL
  override. When empty, Vestra reuses `AI_API_BASE_URL`.
- `STYLIST_AI_MODEL_ID` - optional stylist-specific model override. When empty,
  Vestra reuses `AI_MODEL_ID`.
- `STYLIST_AI_REQUEST_TIMEOUT_MS` - stylist provider request timeout. Defaults
  to `20000`; Vestra clamps this value between 5000 and 45000 ms.
- `BACKGROUND_REMOVAL_PROVIDER` - `mock` for development or `api` for production.
- `BACKGROUND_REMOVAL_API_KEY` - required when `BACKGROUND_REMOVAL_PROVIDER=api`.
- `BACKGROUND_REMOVAL_API_URL` - required production background-removal endpoint.
- `BACKGROUND_REMOVAL_MODEL_ID` - model identifier sent to the background-removal API.
- `BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS` - timeout for background-removal API calls.
- `BACKGROUND_REMOVAL_SIZE` - remove.bg output size, defaults to `auto`.
- `WEATHER_PROVIDER` - `mock` for explicit local development or `api` for a real provider.
- `WEATHER_API_KEY` - required when `WEATHER_PROVIDER=api`.
- `WEATHER_API_BASE_URL` - required weather API base URL. Vestra calls `/forecast`.
- `WEATHER_REQUEST_TIMEOUT_MS` - timeout for weather provider calls.
- `WEATHER_CACHE_TTL_SECONDS` - in-memory weather cache TTL.

## Public Variables

- `NEXT_PUBLIC_APP_URL` - browser-visible canonical app URL.
- `NEXT_PUBLIC_DEFAULT_LOCALE` - default locale, currently `az`.
- `LOCAL_STORAGE_PUBLIC_BASE_URL` - reserved for local storage URL customization.

## Email Verification

Vestra uses Better Auth's native email verification flow for email/password
accounts. Better Auth generates secure, expiring verification links and marks
`user.emailVerified` after a valid verification. Vestra is responsible for safe
email delivery, localized copy, resend throttling, and server-side guards for
sensitive actions.

Local development may use the manual provider:

```env
EMAIL_PROVIDER="manual"
```

Manual mode never sends real email and is blocked in production. It also avoids
logging full verification URLs or tokens.

Production should use a transactional email provider. The built-in production
adapter is Resend:

```env
EMAIL_PROVIDER="resend"
EMAIL_FROM="Vestra <noreply@your-domain.com>"
EMAIL_REPLY_TO="support@your-domain.com"
RESEND_API_KEY="<server-only-resend-api-key>"
EMAIL_REQUEST_TIMEOUT_MS="10000"
EMAIL_VERIFICATION_EXPIRES_SECONDS="86400"
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS="60"
```

Keep all email provider secrets server-only. Verification links are generated
from `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`; Vestra does not trust request
host headers when rebuilding token links.

Before enabling verification in production, apply the safe legacy-user policy:

```bash
pnpm db:apply
```

The migration `0011_email_verification_legacy_policy.sql` marks existing
credential users verified so accounts created before verification enforcement
are not accidentally blocked from sensitive actions. New users created after the
rollout must verify their email before wardrobe uploads, stylist generation, or
account-sensitive writes are allowed.

## Local Setup

Copy `.env.example` to `.env`, then replace all placeholder values.

For phone testing on the same Wi-Fi network, run the dev server on all
interfaces and open the machine's LAN URL on the phone. In development, Better
Auth automatically trusts private IPv4 LAN origins on the same port as
`BETTER_AUTH_URL`. If your adapter is not detected, set
`BETTER_AUTH_TRUSTED_ORIGINS` manually.

Never commit `.env` or production secrets.

## Storage

Local development may use:

```env
STORAGE_DRIVER="local"
```

Staging and production must use Cloudflare R2:

```env
STORAGE_DRIVER="r2"
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_ENDPOINT=""
R2_REQUEST_TIMEOUT_MS="10000"
```

R2 credentials are server-only. Wardrobe images are delivered through
authenticated app routes, not public bucket URLs or permanently stored signed
URLs.

Run a sanitized storage check after manually configuring credentials:

```bash
pnpm storage:diagnose
```

## AI Analysis Credentials

Real clothing analysis requires:

- `AI_PROVIDER=openai-compatible`
- `AI_API_KEY`
- `AI_API_BASE_URL`
- `AI_MODEL_ID`

If these values are missing, Vestra fails analysis explicitly instead of
returning fake production-like clothing metadata.

OpenRouter requests include:

- `Authorization: Bearer <AI_API_KEY>`
- `Content-Type: application/json`
- `HTTP-Referer: http://localhost:3000` by default
- `X-OpenRouter-Title: Vestra`

Run a server-only sanitized connectivity check with:

```bash
pnpm ai:diagnose:openrouter
```

## AI Stylist Credentials

Production stylist generation uses `STYLIST_AI_PROVIDER`.

Recommended Vercel configuration when using the same OpenRouter credentials as
clothing analysis:

```env
STYLIST_AI_PROVIDER="api"
AI_API_KEY="<your-openrouter-key>"
AI_API_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL_ID="<text-capable-openrouter-model>"
OPENROUTER_HTTP_REFERER="https://your-production-domain"
STYLIST_AI_REQUEST_TIMEOUT_MS="20000"
```

`STYLIST_AI_API_KEY`, `STYLIST_AI_API_URL`, and `STYLIST_AI_MODEL_ID` are
optional overrides only. Leave them empty unless stylist generation should use a
different key, base URL, or model from clothing analysis.

Vestra never silently falls back to the mock stylist in production. If
`STYLIST_AI_PROVIDER=mock` is set in production, generation fails with a clear
configuration error. If real credentials are missing, generation fails before
the external request and logs only safe diagnostics: resolved provider,
credential presence, model id, and request URL host.

For `nex-agi/nex-n2-mini`, Vestra uses `json_object` directly because strict
`json_schema` has not behaved reliably in production on OpenRouter. Other models
default to strict `json_schema` first, with one controlled fallback to
`json_object` for structured-output rejection or transient provider failure.

## Background Removal Credentials

Real background removal requires:

- `BACKGROUND_REMOVAL_PROVIDER=removebg` or `BACKGROUND_REMOVAL_PROVIDER=api`
- `BACKGROUND_REMOVAL_API_KEY`
- `BACKGROUND_REMOVAL_API_URL`
- optional `BACKGROUND_REMOVAL_MODEL_ID`
- optional `BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS`
- optional `BACKGROUND_REMOVAL_SIZE=auto` for remove.bg

Run a server-only sanitized connectivity check with:

```bash
pnpm background-removal:diagnose
```

The mock provider is local-only and returns a synthetic transparent image. It is
blocked in production and must not be used for public launch.

## Weather Provider

Weather-aware planning uses server-only weather credentials:

```env
WEATHER_PROVIDER="mock"
WEATHER_API_KEY=""
WEATHER_API_BASE_URL=""
WEATHER_REQUEST_TIMEOUT_MS="7000"
WEATHER_CACHE_TTL_SECONDS="900"
```

Use `WEATHER_PROVIDER=mock` only for explicit local development. Production
weather mode requires a real provider and never falls back to fake weather.

Run a server-only sanitized connectivity check with:

```bash
pnpm weather:diagnose
```

## Production Checklist

Before public deployment, manually configure and verify:

- `DATABASE_URL` points to the production Neon pooled SSL database.
- `BETTER_AUTH_SECRET` is a strong production-only secret.
- `BETTER_AUTH_URL` is the canonical production URL.
- `BETTER_AUTH_TRUSTED_ORIGINS` contains only approved production origins.
- `NEXT_PUBLIC_APP_URL` is the canonical production URL.
- `EMAIL_PROVIDER=resend` with `EMAIL_FROM`, optional `EMAIL_REPLY_TO`,
  `RESEND_API_KEY`, request timeout, verification expiry, and resend cooldown.
- `AI_PROVIDER=openai-compatible` with valid `AI_API_KEY`, `AI_API_BASE_URL`,
  `AI_MODEL_ID`, and OpenRouter referer/title settings when applicable.
- `STYLIST_AI_PROVIDER=api` or `STYLIST_AI_PROVIDER=openai-compatible`. The
  stylist can reuse valid `AI_API_KEY`, `AI_API_BASE_URL`, and `AI_MODEL_ID`;
  set `STYLIST_AI_API_KEY`, `STYLIST_AI_API_URL`, and `STYLIST_AI_MODEL_ID` only
  when stylist generation needs separate credentials.
- `STYLIST_AI_REQUEST_TIMEOUT_MS=20000` for a bounded OpenRouter request.
- `WEATHER_PROVIDER=api` with valid `WEATHER_API_KEY`,
  `WEATHER_API_BASE_URL`, and timeout/cache values.
- `BACKGROUND_REMOVAL_PROVIDER=api` with valid background-removal credentials.
- `STORAGE_DRIVER` uses a production cloud/object storage adapter. Local file
  storage is for development only and is not recommended for public deployment.
- `STORAGE_DRIVER=r2` with valid R2 credentials for Railway staging.
- Mock AI, weather, and background-removal providers are disabled in production.
