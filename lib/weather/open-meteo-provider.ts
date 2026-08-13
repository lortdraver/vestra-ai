import {
  type WeatherCondition,
  type WeatherForecast,
  type WeatherProvider,
  type WeatherProviderInput,
  WeatherProviderError,
} from './types'

type GeocodingResult = {
  name?: string
  country?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) }
}

function clampTimeout(value: string | undefined) {
  const timeoutMs = Number(value ?? 8000)
  if (!Number.isFinite(timeoutMs)) return 8000
  return Math.min(Math.max(timeoutMs, 2000), 20000)
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function weatherCondition(code: number): WeatherCondition {
  if ([0, 1].includes(code)) return 'clear'
  if ([2, 3, 45, 48].includes(code)) return 'cloudy'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow'
  if (code >= 95) return 'storm'
  return 'unknown'
}

function logWeather(
  stage:
    | 'WEATHER_REQUEST_STARTED'
    | 'WEATHER_REQUEST_COMPLETED'
    | 'WEATHER_REQUEST_FAILED',
  details: Record<string, unknown>,
) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[weather] ${stage}`, details)
  }
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  private readonly forecastUrl: string
  private readonly geocodingUrl: string
  private readonly timeoutMs: number

  constructor() {
    this.forecastUrl = (
      process.env.WEATHER_API_BASE_URL ?? 'https://api.open-meteo.com/v1'
    ).replace(/\/$/, '')
    this.geocodingUrl = (
      process.env.WEATHER_GEOCODING_API_BASE_URL ??
      'https://geocoding-api.open-meteo.com/v1'
    ).replace(/\/$/, '')
    this.timeoutMs = clampTimeout(process.env.WEATHER_REQUEST_TIMEOUT_MS)
  }

  async getForecast(input: WeatherProviderInput): Promise<WeatherForecast> {
    const startedAt = Date.now()
    logWeather('WEATHER_REQUEST_STARTED', {
      provider: 'open_meteo',
      hasLocationName: Boolean(input.locationName),
      hasCoordinates: input.latitude != null && input.longitude != null,
      days: input.days ?? 7,
    })

    try {
      const location = await this.resolveLocation(input)
      const url = new URL(`${this.forecastUrl}/forecast`)
      url.searchParams.set('latitude', String(location.latitude))
      url.searchParams.set('longitude', String(location.longitude))
      url.searchParams.set('timezone', input.timezone ?? location.timezone)
      url.searchParams.set('forecast_days', String(input.days ?? 7))
      url.searchParams.set(
        'current',
        [
          'temperature_2m',
          'apparent_temperature',
          'precipitation',
          'rain',
          'snowfall',
          'weather_code',
          'relative_humidity_2m',
          'wind_speed_10m',
        ].join(','),
      )
      url.searchParams.set(
        'daily',
        [
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_probability_max',
          'rain_sum',
          'snowfall_sum',
          'wind_speed_10m_max',
          'sunrise',
          'sunset',
        ].join(','),
      )
      url.searchParams.set('hourly', 'temperature_2m,precipitation_probability')

      const data = await this.fetchJson(url)
      const forecast = this.normalizeForecast(data, location)

      logWeather('WEATHER_REQUEST_COMPLETED', {
        provider: 'open_meteo',
        durationMs: Date.now() - startedAt,
        dailyCount: forecast.daily.length,
      })

      return forecast
    } catch (error) {
      logWeather('WEATHER_REQUEST_FAILED', {
        provider: 'open_meteo',
        durationMs: Date.now() - startedAt,
        code:
          error instanceof WeatherProviderError
            ? error.code
            : 'weather_provider_unavailable',
      })
      throw error
    }
  }

  private async resolveLocation(input: WeatherProviderInput) {
    if (input.latitude != null && input.longitude != null) {
      return {
        name: input.locationName?.trim() || 'Selected location',
        latitude: input.latitude,
        longitude: input.longitude,
        timezone: input.timezone ?? 'auto',
      }
    }

    const query = input.locationName?.trim()
    if (!query) throw new WeatherProviderError('weather_invalid_location')

    const url = new URL(`${this.geocodingUrl}/search`)
    url.searchParams.set('name', query)
    url.searchParams.set('count', '1')
    url.searchParams.set('language', 'en')
    url.searchParams.set('format', 'json')

    const data = (await this.fetchJson(url)) as { results?: GeocodingResult[] }
    const result = data.results?.[0]
    if (!result?.latitude || !result.longitude) {
      throw new WeatherProviderError('weather_location_not_found')
    }

    return {
      name: [result.name, result.country].filter(Boolean).join(', '),
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone ?? 'UTC',
    }
  }

  private async fetchJson(url: URL) {
    const timeout = timeoutSignal(this.timeoutMs)
    let response: Response
    try {
      response = await fetch(url, { signal: timeout.signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new WeatherProviderError('weather_timeout')
      }
      throw new WeatherProviderError('weather_provider_unavailable')
    } finally {
      timeout.cancel()
    }

    if (response.status === 400 || response.status === 404) {
      throw new WeatherProviderError('weather_location_not_found')
    }
    if (response.status === 429) {
      throw new WeatherProviderError('weather_rate_limited')
    }
    if (!response.ok) {
      throw new WeatherProviderError('weather_provider_unavailable')
    }

    return response.json()
  }

  private normalizeForecast(
    data: unknown,
    location: WeatherForecast['location'],
  ) {
    const raw = data as Record<string, Record<string, unknown>>
    const current = raw.current ?? {}
    const daily = raw.daily ?? {}
    const hourly = raw.hourly ?? {}
    const now = new Date().toISOString()
    const currentCode = number(current.weather_code)
    const currentPoint = {
      time: String(current.time ?? now),
      temperatureC: number(current.temperature_2m),
      feelsLikeC: number(
        current.apparent_temperature,
        number(current.temperature_2m),
      ),
      precipitationProbability: number(current.precipitation_probability),
      rainMm: number(current.rain),
      snowMm: number(current.snowfall),
      windKph: number(current.wind_speed_10m),
      humidity:
        current.relative_humidity_2m == null
          ? null
          : number(current.relative_humidity_2m),
      uvIndex: null,
      condition: weatherCondition(currentCode),
    }

    const dailyTimes = Array.isArray(daily.time) ? daily.time : []
    const dailyPoints = dailyTimes.map((time, index) => {
      const code = number((daily.weather_code as unknown[])?.[index])
      const minTemperatureC = number(
        (daily.temperature_2m_min as unknown[])?.[index],
        currentPoint.temperatureC,
      )
      const maxTemperatureC = number(
        (daily.temperature_2m_max as unknown[])?.[index],
        currentPoint.temperatureC,
      )
      return {
        time: String(time),
        temperatureC: Math.round((minTemperatureC + maxTemperatureC) / 2),
        feelsLikeC: Math.round((minTemperatureC + maxTemperatureC) / 2),
        precipitationProbability: number(
          (daily.precipitation_probability_max as unknown[])?.[index],
        ),
        rainMm: number((daily.rain_sum as unknown[])?.[index]),
        snowMm: number((daily.snowfall_sum as unknown[])?.[index]),
        windKph: number((daily.wind_speed_10m_max as unknown[])?.[index]),
        humidity: null,
        uvIndex: null,
        condition: weatherCondition(code),
        minTemperatureC,
        maxTemperatureC,
        sunrise: String((daily.sunrise as unknown[])?.[index] ?? '') || null,
        sunset: String((daily.sunset as unknown[])?.[index] ?? '') || null,
      }
    })

    const hourlyTimes = Array.isArray(hourly.time) ? hourly.time : []
    const hourlyPoints = hourlyTimes.slice(0, 24).map((time, index) => ({
      ...currentPoint,
      time: String(time),
      temperatureC: number(
        (hourly.temperature_2m as unknown[])?.[index],
        currentPoint.temperatureC,
      ),
      precipitationProbability: number(
        (hourly.precipitation_probability as unknown[])?.[index],
        currentPoint.precipitationProbability,
      ),
    }))

    return {
      location,
      current: currentPoint,
      hourly: hourlyPoints,
      daily: dailyPoints,
      fetchedAt: now,
      provider: 'open_meteo',
      stale: false,
    }
  }
}
