# Environment

## Required Variables

- `DATABASE_URL` - Neon PostgreSQL connection string. Use a pooled SSL connection for production.
- `BETTER_AUTH_SECRET` - random secret with at least 32 bytes of entropy.
- `BETTER_AUTH_URL` - canonical app URL used by Better Auth.
- `BETTER_AUTH_TRUSTED_ORIGINS` - optional comma-separated local development
  origins, for example `http://192.168.100.8:3000`.
- `STORAGE_DRIVER` - object storage adapter. Use `local` only for development.
- `AI_PROVIDER` - `openai-compatible` for real clothing analysis. Use `mock`
  only for tests or explicit local mock mode.
- `AI_API_KEY` - required when `AI_PROVIDER=openai-compatible`.
- `AI_API_BASE_URL` - required OpenAI-compatible base URL. For OpenRouter use
  `https://openrouter.ai/api/v1`; Vestra sends requests to
  `https://openrouter.ai/api/v1/chat/completions`.
- `AI_MODEL_ID` - required model identifier for analysis.
- `OPENROUTER_HTTP_REFERER` - optional OpenRouter referer override. Defaults to
  `http://localhost:3000`.
- `BACKGROUND_REMOVAL_PROVIDER` - `mock` for development or `api` for production.
- `BACKGROUND_REMOVAL_API_KEY` - required when `BACKGROUND_REMOVAL_PROVIDER=api`.
- `BACKGROUND_REMOVAL_API_URL` - required production background-removal endpoint.
- `BACKGROUND_REMOVAL_MODEL_ID` - model identifier sent to the background-removal API.
- `BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS` - timeout for background-removal API calls.
- `WEATHER_PROVIDER` - `mock` for explicit local development or `api` for a real provider.
- `WEATHER_API_KEY` - required when `WEATHER_PROVIDER=api`.
- `WEATHER_API_BASE_URL` - required weather API base URL. Vestra calls `/forecast`.
- `WEATHER_REQUEST_TIMEOUT_MS` - timeout for weather provider calls.
- `WEATHER_CACHE_TTL_SECONDS` - in-memory weather cache TTL.

## Public Variables

- `NEXT_PUBLIC_APP_URL` - browser-visible canonical app URL.
- `NEXT_PUBLIC_DEFAULT_LOCALE` - default locale, currently `az`.
- `LOCAL_STORAGE_PUBLIC_BASE_URL` - reserved for local storage URL customization.

## Local Setup

Copy `.env.example` to `.env`, then replace all placeholder values.

For phone testing on the same Wi-Fi network, run the dev server on all
interfaces and open the machine's LAN URL on the phone. In development, Better
Auth automatically trusts private IPv4 LAN origins on the same port as
`BETTER_AUTH_URL`. If your adapter is not detected, set
`BETTER_AUTH_TRUSTED_ORIGINS` manually.

Never commit `.env` or production secrets.

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

## Background Removal Credentials

Real background removal requires:

- `BACKGROUND_REMOVAL_PROVIDER=api`
- `BACKGROUND_REMOVAL_API_KEY`
- `BACKGROUND_REMOVAL_API_URL`
- optional `BACKGROUND_REMOVAL_MODEL_ID`
- optional `BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS`

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
- `AI_PROVIDER=openai-compatible` with valid `AI_API_KEY`, `AI_API_BASE_URL`,
  `AI_MODEL_ID`, and OpenRouter referer/title settings when applicable.
- `WEATHER_PROVIDER=api` with valid `WEATHER_API_KEY`,
  `WEATHER_API_BASE_URL`, and timeout/cache values.
- `BACKGROUND_REMOVAL_PROVIDER=api` with valid background-removal credentials.
- `STORAGE_DRIVER` uses a production cloud/object storage adapter. Local file
  storage is for development only and is not recommended for public deployment.
- Mock AI, weather, and background-removal providers are disabled in production.
