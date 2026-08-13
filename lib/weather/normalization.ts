import type {
  DailyWeather,
  NormalizedWeatherContext,
  PrecipitationBand,
  TemperatureBand,
  WeatherChangeAssessment,
  WeatherCondition,
  WeatherForecast,
  WeatherPoint,
  WeatherSnapshot,
  WindBand,
} from './types'

export const weatherChangeThresholds = {
  temperatureDeltaC: 6,
} as const

export function getTemperatureBand(value: number): TemperatureBand {
  if (value <= 0) return 'freezing'
  if (value <= 8) return 'cold'
  if (value <= 15) return 'cool'
  if (value <= 22) return 'mild'
  if (value <= 28) return 'warm'
  return 'hot'
}

export function getPrecipitationBand(input: {
  precipitationProbability: number
  rainMm?: number
  snowMm?: number
  condition?: WeatherCondition
}): PrecipitationBand {
  if ((input.snowMm ?? 0) > 0 || input.condition === 'snow') return 'snow'
  if (
    (input.rainMm ?? 0) > 0 ||
    input.condition === 'rain' ||
    input.precipitationProbability >= 45
  ) {
    return 'rain'
  }
  return 'none'
}

export function getWindBand(windKph: number): WindBand {
  return windKph >= 35 ? 'windy' : 'calm'
}

function normalizeDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10)
}

function pointForDate(forecast: WeatherForecast, date: string) {
  const target = normalizeDate(date)
  const daily = forecast.daily.find(
    (entry) => normalizeDate(entry.time) === target,
  )
  return daily ?? forecast.daily[0] ?? forecast.current
}

export function normalizeWeatherForDate(
  forecast: WeatherForecast,
  date: string,
): NormalizedWeatherContext {
  const point = pointForDate(forecast, date) as WeatherPoint | DailyWeather
  const temperatureC = Number(point.temperatureC)
  const feelsLikeC = Number(point.feelsLikeC || temperatureC)
  const precipitationProbability = Math.max(
    0,
    Math.min(100, Number(point.precipitationProbability ?? 0)),
  )
  const condition = point.condition ?? 'unknown'
  const precipitation = getPrecipitationBand({
    precipitationProbability,
    rainMm: point.rainMm,
    snowMm: point.snowMm,
    condition,
  })
  const dateKey = normalizeDate(date)

  return {
    date: dateKey,
    locationName: forecast.location.name,
    timezone: forecast.location.timezone,
    temperatureC,
    feelsLikeC,
    minTemperatureC: 'minTemperatureC' in point ? point.minTemperatureC : null,
    maxTemperatureC: 'maxTemperatureC' in point ? point.maxTemperatureC : null,
    precipitationProbability,
    rainExpected: precipitation === 'rain',
    snowExpected: precipitation === 'snow',
    windSpeedKph: Number(point.windKph ?? 0),
    humidity: point.humidity ?? null,
    condition,
    conditionCode: condition,
    temperatureBand: getTemperatureBand(feelsLikeC || temperatureC),
    precipitation,
    wind: getWindBand(Number(point.windKph ?? 0)),
  }
}

export function toWeatherSnapshot(
  context: NormalizedWeatherContext,
): WeatherSnapshot {
  return {
    date: context.date,
    locationName: context.locationName,
    timezone: context.timezone,
    temperatureC: context.temperatureC,
    feelsLikeC: context.feelsLikeC,
    minTemperatureC: context.minTemperatureC,
    maxTemperatureC: context.maxTemperatureC,
    precipitationProbability: context.precipitationProbability,
    rainExpected: context.rainExpected,
    snowExpected: context.snowExpected,
    condition: context.condition,
    temperatureBand: context.temperatureBand,
    precipitation: context.precipitation,
  }
}

export function assessWeatherChange(
  previous: WeatherSnapshot,
  current: WeatherSnapshot,
): WeatherChangeAssessment {
  const reasons: WeatherChangeAssessment['reasons'] = []
  const temperatureDeltaC = Math.abs(current.feelsLikeC - previous.feelsLikeC)

  if (temperatureDeltaC > weatherChangeThresholds.temperatureDeltaC) {
    reasons.push('temperature_changed')
  }
  if (!previous.rainExpected && current.rainExpected) {
    reasons.push('rain_introduced')
  }
  if (!previous.snowExpected && current.snowExpected) {
    reasons.push('snow_introduced')
  }
  if (previous.temperatureBand !== current.temperatureBand) {
    const pair = new Set([previous.temperatureBand, current.temperatureBand])
    if (
      (pair.has('cold') || pair.has('freezing')) &&
      (pair.has('warm') || pair.has('hot'))
    ) {
      reasons.push('temperature_band_changed')
    }
  }

  return {
    changed: reasons.length > 0,
    reasons: Array.from(new Set(reasons)),
    temperatureDeltaC,
    previous,
    current,
  }
}
