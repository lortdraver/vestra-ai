import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyWeatherSuitability,
  clearWeatherCache,
  getCachedForecast,
  getWeatherCacheKey,
  getWeatherProvider,
  getWeatherSignals,
  setCachedForecast,
  WeatherProviderError,
  type WeatherForecast,
} from '@/lib/weather'
import type { StylistWardrobeItem } from '@/lib/stylist'

const current = {
  time: '2026-07-12T08:00:00.000Z',
  temperatureC: 31,
  feelsLikeC: 34,
  precipitationProbability: 70,
  rainMm: 1,
  snowMm: 0,
  windKph: 40,
  humidity: 70,
  uvIndex: 8,
  condition: 'rain' as const,
}

const forecast: WeatherForecast = {
  location: {
    name: 'Baku',
    latitude: 40.4093,
    longitude: 49.8671,
    timezone: 'Asia/Baku',
  },
  current,
  hourly: [current],
  daily: [
    {
      ...current,
      minTemperatureC: 20,
      maxTemperatureC: 32,
      sunrise: null,
      sunset: null,
    },
  ],
  fetchedAt: '2026-07-12T08:00:00.000Z',
  provider: 'test',
  stale: false,
}

const wardrobe: StylistWardrobeItem[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Cotton tee',
    category: 'tops',
    clothingType: 't-shirt',
    colors: ['grey'],
    seasons: ['summer'],
    styles: ['casual'],
    material: 'cotton',
    brand: '',
    notes: '',
    imageUrl: '/tee.webp',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Linen trousers',
    category: 'bottoms',
    clothingType: 'trousers',
    colors: ['beige'],
    seasons: ['summer'],
    styles: ['casual'],
    material: 'linen',
    brand: '',
    notes: '',
    imageUrl: '/pants.webp',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Waterproof boots',
    category: 'shoes',
    clothingType: 'boots',
    colors: ['black'],
    seasons: ['autumn'],
    styles: ['casual'],
    material: 'waterproof leather',
    brand: '',
    notes: '',
    imageUrl: '/boots.webp',
  },
]

afterEach(() => {
  vi.unstubAllEnvs()
  clearWeatherCache()
})

describe('weather provider selection', () => {
  it('uses mock provider only when explicitly configured', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('WEATHER_PROVIDER', 'mock')

    const result = await getWeatherProvider().getForecast({
      locationName: 'Baku',
    })

    expect(result.provider).toBe('mock')
  })

  it('throws a structured missing credentials error without provider mode', () => {
    vi.stubEnv('WEATHER_PROVIDER', '')

    expect(() => getWeatherProvider()).toThrow(WeatherProviderError)
  })

  it('blocks mock provider in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('WEATHER_PROVIDER', 'mock')

    expect(() => getWeatherProvider()).toThrow('weather_credentials_missing')
  })
})

describe('weather cache', () => {
  it('returns fresh cache hits before expiry', () => {
    const key = getWeatherCacheKey({ locationName: 'Baku' })
    setCachedForecast(key, forecast, 60, 1000)

    expect(getCachedForecast(key, 2000)?.isFresh).toBe(true)
  })

  it('returns stale cache after expiry for fallback use', () => {
    const key = getWeatherCacheKey({ locationName: 'Baku' })
    setCachedForecast(key, forecast, 1, 1000)

    expect(getCachedForecast(key, 3000)?.isFresh).toBe(false)
  })
})

describe('weather suitability', () => {
  it('detects hot, rain, wind, high UV, and temperature swings', () => {
    expect(getWeatherSignals(current, forecast)).toEqual([
      'hot',
      'rain',
      'strong_wind',
      'high_uv',
      'temperature_swing',
    ])
  })

  it('keeps owned compatible items and reports missing outerwear for rain', () => {
    const result = applyWeatherSuitability(wardrobe, forecast, [
      'tops',
      'bottoms',
      'shoes',
    ])

    expect(result.suitableItems.map((item) => item.id)).toEqual(
      wardrobe.map((item) => item.id),
    )
    expect(result.missingCategories).toContain('outerwear')
  })
})
