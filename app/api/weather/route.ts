import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
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

export async function GET(request: Request) {
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
    return NextResponse.json({
      forecast: cached.forecast,
      cache: { hit: true, stale: false },
    })
  }

  try {
    const provider = getWeatherProvider()
    const forecast = await provider.getForecast(input)
    const ttl = Number(process.env.WEATHER_CACHE_TTL_SECONDS ?? 900)
    setCachedForecast(key, forecast, ttl)
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
      const status =
        error.code === 'weather_invalid_location'
          ? 400
          : error.code === 'weather_rate_limited'
            ? 429
            : error.code === 'weather_credentials_missing'
              ? 503
              : 502
      return NextResponse.json({ error: error.code }, { status })
    }

    return NextResponse.json(
      { error: 'weather_provider_unavailable' },
      { status: 502 },
    )
  }
}
