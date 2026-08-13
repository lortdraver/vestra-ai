# Weather Intelligence

Vestra weather is server-side only. Browser code never receives provider
credentials and never calls the external weather API directly.

## Provider Modes

- `WEATHER_PROVIDER=open_meteo` uses the production Open-Meteo adapter.
- `WEATHER_PROVIDER=api` keeps the generic bearer-token adapter for another
  vendor that already returns Vestra's normalized response shape.
- `WEATHER_PROVIDER=mock` is allowed only for explicit local development and is
  blocked in production.

Recommended production variables:

```env
WEATHER_PROVIDER="open_meteo"
WEATHER_API_BASE_URL="https://api.open-meteo.com/v1"
WEATHER_GEOCODING_API_BASE_URL="https://geocoding-api.open-meteo.com/v1"
WEATHER_REQUEST_TIMEOUT_MS="8000"
WEATHER_CACHE_TTL_SECONDS="900"
```

`WEATHER_API_KEY` is intentionally optional for Open-Meteo. If Vestra switches
to a paid weather vendor later, keep the key server-only and use a dedicated
provider adapter or the existing generic `api` adapter.

## Normalized Model

Provider responses are converted into a normalized `WeatherForecast` with:

- location name, coordinates, and timezone;
- current weather;
- hourly forecast;
- daily forecast;
- temperature, feels-like, min/max temperature;
- precipitation probability, rain, snow, wind, humidity;
- condition and condition code.

Planner and stylist logic consume `NormalizedWeatherContext`, not provider raw
JSON. The context includes:

- `temperatureBand`: `freezing`, `cold`, `cool`, `mild`, `warm`, `hot`;
- `precipitation`: `none`, `rain`, `snow`;
- `wind`: `calm`, `windy`.

## Location

Users set weather location explicitly in the planner. They can type a city such
as Baku, Vienna, or Klagenfurt. Optional browser geolocation is only requested
after the user clicks the location action. Vestra does not request continuous
background location.

The selected location is stored in browser localStorage for convenience and on
individual outfit plans when scheduled. Coordinates are not sent to analytics.

## Cache

Forecasts are cached in memory by normalized city name or rounded coordinates.
Default TTL is 900 seconds. Fresh cache hits avoid provider calls. If the
provider fails but stale data exists, the weather API can return the stale
forecast with `cache.stale=true`.

## Diagnostics

Safe logs:

- `WEATHER_REQUEST_STARTED`
- `WEATHER_REQUEST_COMPLETED`
- `WEATHER_REQUEST_FAILED`
- `WEATHER_CACHE_HIT`

Logs may include provider, duration, cache state, status/code, date count, and
whether a request used a city or coordinates. Logs must never include API keys,
auth headers, exact unnecessary personal location data, or analytics payloads
containing raw location text.

Run:

```bash
pnpm weather:diagnose
```

## Failure Behavior

Stable errors:

- `weather_not_configured`
- `weather_credentials_missing`
- `weather_invalid_location`
- `weather_location_not_found`
- `weather_rate_limited`
- `weather_timeout`
- `weather_provider_unavailable`

Planner remains usable when weather fails. Users can still choose saved outfits
and schedule manually; weather-aware generation falls back with a clear message.
