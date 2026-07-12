export type WeatherCondition =
  'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'wind' | 'unknown'

export type WeatherPoint = {
  time: string
  temperatureC: number
  feelsLikeC: number
  precipitationProbability: number
  rainMm: number
  snowMm: number
  windKph: number
  humidity: number | null
  uvIndex: number | null
  condition: WeatherCondition
}

export type DailyWeather = WeatherPoint & {
  minTemperatureC: number
  maxTemperatureC: number
  sunrise: string | null
  sunset: string | null
}

export type WeatherLocation = {
  name: string
  latitude: number
  longitude: number
  timezone: string
}

export type WeatherForecast = {
  location: WeatherLocation
  current: WeatherPoint
  hourly: WeatherPoint[]
  daily: DailyWeather[]
  fetchedAt: string
  provider: string
  stale: boolean
}

export type WeatherProviderInput = {
  locationName?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface WeatherProvider {
  getForecast(input: WeatherProviderInput): Promise<WeatherForecast>
}

export type WeatherErrorCode =
  | 'weather_credentials_missing'
  | 'weather_invalid_location'
  | 'weather_rate_limited'
  | 'weather_timeout'
  | 'weather_provider_unavailable'

export class WeatherProviderError extends Error {
  constructor(
    public code: WeatherErrorCode,
    message = code,
  ) {
    super(message)
  }
}
