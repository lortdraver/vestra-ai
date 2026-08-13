import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyWeatherSuitability,
  clearWeatherCache,
  getCachedForecast,
  getWeatherCacheKey,
  getWeatherProvider,
  getWeatherSignals,
  normalizeWeatherForDate,
  assessWeatherChange,
  toWeatherSnapshot,
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

const wardrobeDefaults = {
  formalityLevel: 2,
  fit: 'regular',
  pattern: 'solid',
  warmthLevel: 2,
  wearCount: 0,
  lastWornAt: null,
} satisfies Pick<
  StylistWardrobeItem,
  | 'formalityLevel'
  | 'fit'
  | 'pattern'
  | 'warmthLevel'
  | 'wearCount'
  | 'lastWornAt'
>

const wardrobe: StylistWardrobeItem[] = [
  {
    ...wardrobeDefaults,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Cotton tee',
    role: 'top',
    subtype: 't_shirt',
    category: 'top',
    clothingType: 't_shirt',
    colors: ['grey'],
    colorFamilies: ['gray'],
    seasons: ['summer'],
    styles: ['casual'],
    styleTags: ['casual'],
    formality: 'casual',
    material: 'cotton',
    brand: '',
    notes: '',
    imageUrl: '/tee.webp',
  },
  {
    ...wardrobeDefaults,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Linen trousers',
    role: 'bottom',
    subtype: 'trousers',
    category: 'bottom',
    clothingType: 'trousers',
    colors: ['beige'],
    colorFamilies: ['beige'],
    seasons: ['summer'],
    styles: ['casual'],
    styleTags: ['casual'],
    formality: 'casual',
    material: 'linen',
    brand: '',
    notes: '',
    imageUrl: '/pants.webp',
  },
  {
    ...wardrobeDefaults,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Waterproof boots',
    role: 'shoes',
    subtype: 'boots',
    category: 'shoes',
    clothingType: 'boots',
    colors: ['black'],
    colorFamilies: ['black'],
    seasons: ['autumn'],
    styles: ['casual'],
    styleTags: ['casual'],
    formality: 'casual',
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
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('WEATHER_PROVIDER', '')

    expect(() => getWeatherProvider()).toThrow(WeatherProviderError)
  })

  it('blocks mock provider in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('WEATHER_PROVIDER', 'mock')

    expect(() => getWeatherProvider()).toThrow('weather_credentials_missing')
  })

  it('selects the Open-Meteo production provider explicitly', async () => {
    vi.stubEnv('WEATHER_PROVIDER', 'open_meteo')
    const fetchMock = vi.fn(async (url: string | URL) => {
      const value = String(url)
      if (value.includes('geocoding')) {
        return Response.json({
          results: [
            {
              name: 'Baku',
              country: 'Azerbaijan',
              latitude: 40.4093,
              longitude: 49.8671,
              timezone: 'Asia/Baku',
            },
          ],
        })
      }
      return Response.json({
        current: {
          time: '2026-07-12T08:00',
          temperature_2m: 18,
          apparent_temperature: 16,
          precipitation: 1,
          rain: 1,
          snowfall: 0,
          weather_code: 61,
          relative_humidity_2m: 72,
          wind_speed_10m: 20,
        },
        daily: {
          time: ['2026-07-12'],
          weather_code: [61],
          temperature_2m_max: [20],
          temperature_2m_min: [14],
          precipitation_probability_max: [70],
          rain_sum: [2],
          snowfall_sum: [0],
          wind_speed_10m_max: [24],
          sunrise: ['2026-07-12T06:00'],
          sunset: ['2026-07-12T20:00'],
        },
        hourly: { time: [], temperature_2m: [], precipitation_probability: [] },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getWeatherProvider().getForecast({
      locationName: 'Baku',
    })

    expect(result.provider).toBe('open_meteo')
    expect(result.current.condition).toBe('rain')
    expect(result.daily[0].minTemperatureC).toBe(14)
  })

  it('maps Open-Meteo geocoding misses to location-not-found', async () => {
    vi.stubEnv('WEATHER_PROVIDER', 'open_meteo')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ results: [] })),
    )

    await expect(
      getWeatherProvider().getForecast({ locationName: 'Unknown place' }),
    ).rejects.toMatchObject({ code: 'weather_location_not_found' })
  })

  it('maps Open-Meteo rate limits to weather_rate_limited', async () => {
    vi.stubEnv('WEATHER_PROVIDER', 'open_meteo')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429 })),
    )

    await expect(
      getWeatherProvider().getForecast({ locationName: 'Baku' }),
    ).rejects.toMatchObject({ code: 'weather_rate_limited' })
  })

  it('maps Open-Meteo provider failures to weather_provider_unavailable', async () => {
    vi.stubEnv('WEATHER_PROVIDER', 'open_meteo')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    )

    await expect(
      getWeatherProvider().getForecast({ locationName: 'Baku' }),
    ).rejects.toMatchObject({ code: 'weather_provider_unavailable' })
  })

  it('maps Open-Meteo aborted requests to weather_timeout', async () => {
    vi.stubEnv('WEATHER_PROVIDER', 'open_meteo')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }),
    )

    await expect(
      getWeatherProvider().getForecast({ locationName: 'Baku' }),
    ).rejects.toMatchObject({ code: 'weather_timeout' })
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

describe('weather normalization and forecast change detection', () => {
  it('normalizes weather into fashion context bands', () => {
    const context = normalizeWeatherForDate(forecast, '2026-07-12')

    expect(context.temperatureBand).toBe('hot')
    expect(context.precipitation).toBe('rain')
    expect(context.wind).toBe('windy')
    expect(context.rainExpected).toBe(true)
  })

  it('ignores small weather changes', () => {
    const previous = toWeatherSnapshot(
      normalizeWeatherForDate(forecast, '2026-07-12'),
    )
    const current = { ...previous, feelsLikeC: previous.feelsLikeC + 2 }

    expect(assessWeatherChange(previous, current).changed).toBe(false)
  })

  it('flags material temperature changes and introduced rain', () => {
    const dryForecast: WeatherForecast = {
      ...forecast,
      current: {
        ...forecast.current,
        temperatureC: 14,
        feelsLikeC: 14,
        precipitationProbability: 0,
        rainMm: 0,
        condition: 'cloudy',
      },
      daily: [
        {
          ...forecast.daily[0],
          temperatureC: 14,
          feelsLikeC: 14,
          minTemperatureC: 12,
          maxTemperatureC: 16,
          precipitationProbability: 0,
          rainMm: 0,
          snowMm: 0,
          windKph: 10,
          condition: 'cloudy',
        },
      ],
    }
    const previous = toWeatherSnapshot(
      normalizeWeatherForDate(dryForecast, '2026-07-12'),
    )
    const current = toWeatherSnapshot(
      normalizeWeatherForDate(forecast, '2026-07-12'),
    )

    const assessment = assessWeatherChange(previous, current)
    expect(assessment.changed).toBe(true)
    expect(assessment.reasons).toContain('temperature_changed')
    expect(assessment.reasons).toContain('rain_introduced')
  })
})
