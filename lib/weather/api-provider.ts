import {
  type WeatherCondition,
  type WeatherForecast,
  type WeatherProvider,
  type WeatherProviderInput,
  WeatherProviderError,
} from './types'

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) }
}

function numberOrNull(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function condition(value: unknown): WeatherCondition {
  const raw = String(value ?? 'unknown')
  return raw === 'clear' ||
    raw === 'cloudy' ||
    raw === 'rain' ||
    raw === 'snow' ||
    raw === 'storm' ||
    raw === 'wind'
    ? raw
    : 'unknown'
}

export class ApiWeatherProvider implements WeatherProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor() {
    const apiKey = process.env.WEATHER_API_KEY
    const baseUrl = process.env.WEATHER_API_BASE_URL
    if (!apiKey || !baseUrl) {
      throw new WeatherProviderError('weather_credentials_missing')
    }

    this.apiKey = apiKey
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.timeoutMs = Number(process.env.WEATHER_REQUEST_TIMEOUT_MS ?? 7000)
  }

  async getForecast(input: WeatherProviderInput): Promise<WeatherForecast> {
    const url = new URL(`${this.baseUrl}/forecast`)
    if (input.latitude != null && input.longitude != null) {
      url.searchParams.set('latitude', String(input.latitude))
      url.searchParams.set('longitude', String(input.longitude))
    } else if (input.locationName) {
      url.searchParams.set('q', input.locationName)
    } else {
      throw new WeatherProviderError('weather_invalid_location')
    }
    url.searchParams.set('units', 'metric')

    const timeout = timeoutSignal(this.timeoutMs)
    let response: Response
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: timeout.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new WeatherProviderError('weather_timeout')
      }
      throw new WeatherProviderError('weather_provider_unavailable')
    } finally {
      timeout.cancel()
    }

    if (response.status === 400 || response.status === 404) {
      throw new WeatherProviderError('weather_invalid_location')
    }
    if (response.status === 429) {
      throw new WeatherProviderError('weather_rate_limited')
    }
    if (!response.ok) {
      throw new WeatherProviderError('weather_provider_unavailable')
    }

    const data = (await response.json()) as Record<string, unknown>
    const now = new Date().toISOString()
    const current = (data.current ?? {}) as Record<string, unknown>
    const daily = Array.isArray(data.daily) ? data.daily : []
    const hourly = Array.isArray(data.hourly) ? data.hourly : []
    const location = (data.location ?? {}) as Record<string, unknown>
    const currentPoint = {
      time: String(current.time ?? now),
      temperatureC: numberOrNull(current.temperatureC) ?? 0,
      feelsLikeC: numberOrNull(current.feelsLikeC) ?? 0,
      precipitationProbability:
        numberOrNull(current.precipitationProbability) ?? 0,
      rainMm: numberOrNull(current.rainMm) ?? 0,
      snowMm: numberOrNull(current.snowMm) ?? 0,
      windKph: numberOrNull(current.windKph) ?? 0,
      humidity: numberOrNull(current.humidity),
      uvIndex: numberOrNull(current.uvIndex),
      condition: condition(current.condition),
    }

    return {
      location: {
        name: String(
          location.name ?? input.locationName ?? 'Selected location',
        ),
        latitude: numberOrNull(location.latitude) ?? input.latitude ?? 0,
        longitude: numberOrNull(location.longitude) ?? input.longitude ?? 0,
        timezone: String(location.timezone ?? 'UTC'),
      },
      current: currentPoint,
      hourly: hourly.map((entry) => ({
        ...currentPoint,
        ...(entry as Record<string, unknown>),
      })),
      daily: daily.map((entry) => {
        const row = entry as Record<string, unknown>
        return {
          ...currentPoint,
          ...row,
          condition: condition(row.condition),
          minTemperatureC:
            numberOrNull(row.minTemperatureC) ?? currentPoint.temperatureC,
          maxTemperatureC:
            numberOrNull(row.maxTemperatureC) ?? currentPoint.temperatureC,
          sunrise: String(row.sunrise ?? '') || null,
          sunset: String(row.sunset ?? '') || null,
        }
      }),
      fetchedAt: now,
      provider: 'api',
      stale: false,
    }
  }
}
