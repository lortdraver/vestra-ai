export type WeatherCondition =
  'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'wind' | 'unknown'

export type TemperatureBand =
  'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot'
export type PrecipitationBand = 'none' | 'rain' | 'snow'
export type WindBand = 'calm' | 'windy'

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
  timezone?: string | null
  days?: number | null
}

export interface WeatherProvider {
  getCurrentWeather?(input: WeatherProviderInput): Promise<WeatherPoint>
  getForecast(input: WeatherProviderInput): Promise<WeatherForecast>
}

export type NormalizedWeatherContext = {
  date: string
  locationName: string
  timezone: string
  temperatureC: number
  feelsLikeC: number
  minTemperatureC: number | null
  maxTemperatureC: number | null
  precipitationProbability: number
  rainExpected: boolean
  snowExpected: boolean
  windSpeedKph: number
  humidity: number | null
  condition: WeatherCondition
  conditionCode: string
  temperatureBand: TemperatureBand
  precipitation: PrecipitationBand
  wind: WindBand
}

export type WeatherSnapshot = Pick<
  NormalizedWeatherContext,
  | 'date'
  | 'locationName'
  | 'timezone'
  | 'temperatureC'
  | 'feelsLikeC'
  | 'minTemperatureC'
  | 'maxTemperatureC'
  | 'precipitationProbability'
  | 'rainExpected'
  | 'snowExpected'
  | 'condition'
  | 'temperatureBand'
  | 'precipitation'
>

export type WeatherChangeAssessment = {
  changed: boolean
  reasons: Array<
    | 'temperature_changed'
    | 'rain_introduced'
    | 'snow_introduced'
    | 'temperature_band_changed'
  >
  temperatureDeltaC: number
  previous: WeatherSnapshot
  current: WeatherSnapshot
}

export type WeatherErrorCode =
  | 'weather_credentials_missing'
  | 'weather_invalid_location'
  | 'weather_location_not_found'
  | 'weather_rate_limited'
  | 'weather_timeout'
  | 'weather_provider_unavailable'
  | 'weather_not_configured'

export class WeatherProviderError extends Error {
  constructor(
    public code: WeatherErrorCode,
    message = code,
  ) {
    super(message)
  }
}
