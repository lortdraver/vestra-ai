import type { WeatherForecast } from './types'

type CacheEntry = {
  expiresAt: number
  forecast: WeatherForecast
}

const weatherCache = new Map<string, CacheEntry>()

export function getWeatherCacheKey(input: {
  locationName?: string | null
  latitude?: number | null
  longitude?: number | null
}) {
  if (input.latitude != null && input.longitude != null) {
    return `geo:${input.latitude.toFixed(3)},${input.longitude.toFixed(3)}`
  }

  return `city:${(input.locationName ?? 'baku').trim().toLowerCase()}`
}

export function getCachedForecast(key: string, now = Date.now()) {
  const cached = weatherCache.get(key)
  if (!cached) return null

  return {
    forecast: cached.forecast,
    isFresh: cached.expiresAt > now,
  }
}

export function setCachedForecast(
  key: string,
  forecast: WeatherForecast,
  ttlSeconds: number,
  now = Date.now(),
) {
  weatherCache.set(key, {
    forecast,
    expiresAt: now + Math.max(ttlSeconds, 1) * 1000,
  })
}

export function clearWeatherCache() {
  weatherCache.clear()
}
