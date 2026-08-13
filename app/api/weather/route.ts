import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { trackServerEvent } from '@/lib/analytics/server'
import {
  getCachedForecast,
  getWeatherCacheKey,
  getWeatherProvider,
  setCachedForecast,
  WeatherProviderError,
} from '@/lib/weather'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

function toCoordinate(value: string | null) {
  if (!value) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function logWeatherRoute(
  stage:
    | 'WEATHER_REQUEST_STARTED'
    | 'WEATHER_REQUEST_COMPLETED'
    | 'WEATHER_REQUEST_FAILED'
    | 'WEATHER_CACHE_HIT',
  details: Record<string, unknown>,
) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[weather] ${stage}`, details)
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now()
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const input = {
    locationName: url.searchParams.get('locationName'),
    latitude: toCoordinate(url.searchParams.get('latitude')),
    longitude: toCoordinate(url.searchParams.get('longitude')),
  }
  const key = getWeatherCacheKey(input)
  const cached = getCachedForecast(key)
  if (cached?.isFresh) {
    logWeatherRoute('WEATHER_CACHE_HIT', {
      provider: cached.forecast.provider,
      cacheScope: key.startsWith('geo:') ? 'coordinates' : 'city',
    })
    void trackServerEvent({
      eventName: 'planner_weather_loaded',
      userId,
      properties: { provider: cached.forecast.provider, cacheHit: true },
    })
    return NextResponse.json({
      forecast: cached.forecast,
      cache: { hit: true, stale: false },
    })
  }

  try {
    logWeatherRoute('WEATHER_REQUEST_STARTED', {
      provider: process.env.WEATHER_PROVIDER ?? 'default',
      hasLocationName: Boolean(input.locationName),
      hasCoordinates: input.latitude != null && input.longitude != null,
    })
    const provider = getWeatherProvider()
    const forecast = await provider.getForecast(input)
    const ttl = Number(process.env.WEATHER_CACHE_TTL_SECONDS ?? 900)
    setCachedForecast(key, forecast, ttl)
    logWeatherRoute('WEATHER_REQUEST_COMPLETED', {
      provider: forecast.provider,
      durationMs: Date.now() - startedAt,
      dailyCount: forecast.daily.length,
    })
    void trackServerEvent({
      eventName: 'planner_weather_loaded',
      userId,
      properties: { provider: forecast.provider, cacheHit: false },
    })
    return NextResponse.json({
      forecast,
      cache: { hit: false, stale: false, ttlSeconds: ttl },
    })
  } catch (error) {
    if (cached) {
      return NextResponse.json({
        forecast: { ...cached.forecast, stale: true },
        cache: { hit: true, stale: true },
      })
    }

    if (error instanceof WeatherProviderError) {
      logWeatherRoute('WEATHER_REQUEST_FAILED', {
        provider: process.env.WEATHER_PROVIDER ?? 'default',
        durationMs: Date.now() - startedAt,
        code: error.code,
      })
      void trackServerEvent({
        eventName: 'planner_weather_failed',
        userId,
        properties: { code: error.code },
      })
      const status =
        error.code === 'weather_invalid_location' ||
        error.code === 'weather_location_not_found'
          ? 400
          : error.code === 'weather_rate_limited'
            ? 429
            : error.code === 'weather_credentials_missing' ||
                error.code === 'weather_not_configured'
              ? 503
              : 502
      return NextResponse.json({ error: error.code }, { status })
    }

    logWeatherRoute('WEATHER_REQUEST_FAILED', {
      provider: process.env.WEATHER_PROVIDER ?? 'default',
      durationMs: Date.now() - startedAt,
      code: 'weather_provider_unavailable',
    })
    void trackServerEvent({
      eventName: 'planner_weather_failed',
      userId,
      properties: { code: 'weather_provider_unavailable' },
    })
    return NextResponse.json(
      { error: 'weather_provider_unavailable' },
      { status: 502 },
    )
  }
}
