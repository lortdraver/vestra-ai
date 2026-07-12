# Weather Provider

Milestone 6.3 adds a server-side weather abstraction for weather-aware outfit planning.

## Provider Modes

- `WEATHER_PROVIDER=mock` enables deterministic development weather. It is blocked in production.
- `WEATHER_PROVIDER=api` enables the real provider adapter and requires credentials.
- Missing provider configuration returns `weather_credentials_missing`; Vestra does not silently fake weather when real mode is expected.

## Environment

```env
WEATHER_PROVIDER="mock"
WEATHER_API_KEY=""
WEATHER_API_BASE_URL=""
WEATHER_REQUEST_TIMEOUT_MS="7000"
WEATHER_CACHE_TTL_SECONDS="900"
```

Weather credentials are server-only and are never exposed to the browser.

Run a server-only sanitized connectivity check with:

```bash
pnpm weather:diagnose
```

The diagnostic reports provider mode, whether credentials are present, the
request URL without secrets, HTTP status, timeout/rate-limit/invalid-location
errors, and a short provider message. It never prints the API key.

## Real Provider Contract

Vestra intentionally does not hard-code a specific weather vendor. A real
provider adapter must satisfy this request contract:

- endpoint: `GET ${WEATHER_API_BASE_URL}/forecast`;
- auth: `Authorization: Bearer <WEATHER_API_KEY>`;
- query by coordinates: `latitude`, `longitude`, `units=metric`;
- query by manual location: `q`, `units=metric`;
- timeout: `WEATHER_REQUEST_TIMEOUT_MS`.

The response must be normalized or proxied into this shape:

```json
{
  "location": {
    "name": "Baku",
    "latitude": 40.4093,
    "longitude": 49.8671,
    "timezone": "Asia/Baku"
  },
  "current": {
    "time": "2026-07-12T10:00:00.000Z",
    "temperatureC": 28,
    "feelsLikeC": 30,
    "precipitationProbability": 10,
    "rainMm": 0,
    "snowMm": 0,
    "windKph": 14,
    "humidity": 55,
    "uvIndex": 7,
    "condition": "clear"
  },
  "hourly": [],
  "daily": []
}
```

Supported `condition` values are `clear`, `cloudy`, `rain`, `snow`, `storm`,
`wind`, and `unknown`. Provider errors are mapped to:

- `weather_invalid_location` for invalid or unknown locations;
- `weather_rate_limited` for HTTP 429;
- `weather_timeout` for request timeout;
- `weather_provider_unavailable` for other provider failures.

## Cache

Forecasts are cached in memory by rounded coordinates or city name. Fresh cache hits avoid provider calls. If the provider fails and stale cached data exists, the API returns the stale forecast with `cache.stale=true`.

## Privacy

Browser geolocation is requested only after the user clicks the location action. Coordinates are sent to the server for that request only and are not continuously tracked. The planner can also use manual city entry or a browser-local preferred location.

## Normalization

The app normalizes temperature, feels-like, rain/snow, precipitation probability, wind, humidity, UV, condition, sunrise/sunset, forecast time, and timezone. Celsius is used initially.
