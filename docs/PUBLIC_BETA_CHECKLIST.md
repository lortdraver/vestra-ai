# Public Beta Checklist

## Required Before Public Traffic

- Neon production or staging database is configured.
- `pnpm db:apply` has been run successfully.
- Better Auth production URL and trusted origins are HTTPS-only.
- `STORAGE_DRIVER=r2` is configured.
- R2 storage diagnostic passes.
- Local file storage is not used in public deployment.
- OpenRouter credentials are configured.
- `/api/health` returns healthy for application, database, and storage.
- Sign-up, sign-in, sign-out, and session refresh are tested.
- Wardrobe image upload, private image rendering, edit, and delete queueing are
  tested.
- AI analysis is tested with a real uploaded image.
- Azerbaijani, English, and Russian UI are smoke-tested.

## Not Connected In M6.5A

- WeatherAPI
- remove.bg
- Resend
- Sentry
- real payment providers
- catalogs, stores, shopping, or virtual try-on
