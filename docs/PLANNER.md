# Planner And Weather Intelligence

Planner & Weather Intelligence v1 turns Vestra's existing calendar into a
weather-aware outfit planner.

## Architecture

- Planner UI: `components/planner/planner-page-client.tsx`
- Planner page: `app/dashboard/planner/page.tsx`
- Planner APIs: `app/api/outfit-plans`
- Weather API: `app/api/weather/route.ts`
- Planner service: `lib/planner/server.ts`
- Weather providers: `lib/weather`
- Wear integration: `lib/wear`

The planner reuses the existing `outfit_plan` table. Weather snapshots and
planner metadata are stored in `outfit_plan.metadata`, so this milestone does
not require a database migration.

## User Flow

1. User opens `/dashboard/planner`.
2. Vestra loads month plans, saved outfits, and server-side weather.
3. User chooses a date, location, occasion, and optional private note.
4. Vestra can generate two to three weather-aware stylist candidates.
5. User schedules a generated or saved outfit.
6. Vestra stores a normalized weather snapshot with the plan.
7. When forecasts change materially, Vestra flags the plan and offers adaptation.
8. Today or past plans can be marked worn through the existing wear-log system.

## Weather Provider

Production-ready weather uses the Open-Meteo adapter:

```env
WEATHER_PROVIDER="open_meteo"
WEATHER_API_BASE_URL="https://api.open-meteo.com/v1"
WEATHER_GEOCODING_API_BASE_URL="https://geocoding-api.open-meteo.com/v1"
WEATHER_REQUEST_TIMEOUT_MS="8000"
WEATHER_CACHE_TTL_SECONDS="900"
```

`WEATHER_API_KEY` is optional for Open-Meteo. If Vestra later switches to a paid
vendor, keep the key server-only and add a dedicated adapter or use the generic
`api` adapter if the vendor returns Vestra's normalized response shape.

## Normalized Weather

Planner and stylist code consume normalized weather context:

- date, location name, timezone;
- temperature and feels-like temperature;
- min/max daily temperature;
- precipitation probability, rain, snow, wind, humidity;
- normalized condition and provider condition code;
- fashion bands for temperature, precipitation, and wind.

Temperature bands:

- `freezing`
- `cold`
- `cool`
- `mild`
- `warm`
- `hot`

Precipitation bands:

- `none`
- `rain`
- `snow`

Wind bands:

- `calm`
- `windy`

## Location

Users can type a city such as Baku, Vienna, or Klagenfurt. Optional browser
geolocation is requested only after the user clicks the location action. Vestra
does not use continuous/background location.

The browser stores the last chosen display location in localStorage for
convenience. Scheduled plans store only the location fields needed for the
planner row. Exact coordinates and raw location text are not sent to external
analytics.

## Forecast Changes

When a plan is scheduled, Vestra stores a compact weather snapshot. On later
planner visits, current forecast data is compared against the snapshot.

Material changes include:

- feels-like temperature change greater than 6°C;
- rain introduced;
- snow introduced;
- cold/freezing to warm/hot band changes, or the reverse.

Thresholds live in `lib/weather/normalization.ts`.

## Weather-Aware Styling

Planner requests pass normalized weather context into the existing stylist
generation route. Deterministic weather suitability runs before provider
generation and never invents metadata such as waterproofing or insulation.

Saved outfits are evaluated against the selected day's weather. Weak outfits can
still be scheduled after the user sees a warning.

## Wear History

Marking a planned outfit as worn calls the existing M6.1 wear service. The
idempotency key `plan:{planId}` prevents duplicate wear logs.

## Analytics

Planner v1 emits first-party, privacy-safe events only:

- `planner_weather_loaded`
- `planner_weather_failed`
- `planner_outfit_generated`
- `planner_outfit_scheduled`
- `planner_outfit_changed`
- `planner_weather_change_detected`
- `planner_outfit_adapted`
- `planner_outfit_marked_worn`
- `planner_outfit_deleted`

Events exclude exact coordinates, raw location text, outfit contents, image
URLs, storage keys, private notes, and prompts.

## Failure Behavior

If weather is unavailable, the planner remains usable. Users can still view the
calendar, choose saved outfits, schedule manually, and retry weather-aware
generation later.

Stable weather errors include:

- `weather_not_configured`
- `weather_credentials_missing`
- `weather_invalid_location`
- `weather_location_not_found`
- `weather_rate_limited`
- `weather_timeout`
- `weather_provider_unavailable`

## Diagnostics

Safe weather logs:

- `WEATHER_REQUEST_STARTED`
- `WEATHER_REQUEST_COMPLETED`
- `WEATHER_REQUEST_FAILED`
- `WEATHER_CACHE_HIT`

Logs may include provider, status/code, duration, cache scope, and whether a
request used a city or coordinates. Logs must never include API keys, auth
headers, exact unnecessary personal location data, or image/storage data.

Run:

```bash
pnpm weather:diagnose
```
