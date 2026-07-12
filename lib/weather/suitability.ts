import type { StylistWardrobeItem } from '@/lib/stylist'
import type { WeatherForecast, WeatherPoint } from './types'

export type WeatherSuitabilitySignal =
  | 'hot'
  | 'mild'
  | 'cold'
  | 'rain'
  | 'snow'
  | 'strong_wind'
  | 'high_uv'
  | 'temperature_swing'

export type WeatherSuitabilityResult = {
  signals: WeatherSuitabilitySignal[]
  suitableItems: StylistWardrobeItem[]
  missingCategories: string[]
  explanation: string
}

function text(item: StylistWardrobeItem) {
  return [
    item.name,
    item.category,
    item.clothingType,
    item.material,
    item.brand,
    item.notes,
    ...item.seasons,
    ...item.styles,
  ]
    .join(' ')
    .toLowerCase()
}

export function getWeatherSignals(
  current: WeatherPoint,
  forecast?: WeatherForecast,
): WeatherSuitabilitySignal[] {
  const signals = new Set<WeatherSuitabilitySignal>()
  const temperature = current.feelsLikeC || current.temperatureC
  if (temperature >= 28) signals.add('hot')
  else if (temperature <= 8) signals.add('cold')
  else signals.add('mild')

  if (current.precipitationProbability >= 45 || current.rainMm > 0) {
    signals.add('rain')
  }
  if (current.snowMm > 0 || current.condition === 'snow') signals.add('snow')
  if (current.windKph >= 35 || current.condition === 'wind') {
    signals.add('strong_wind')
  }
  if ((current.uvIndex ?? 0) >= 7) signals.add('high_uv')

  const today = forecast?.daily[0]
  if (today && Math.abs(today.maxTemperatureC - today.minTemperatureC) >= 10) {
    signals.add('temperature_swing')
  }

  return [...signals]
}

function isRainReady(item: StylistWardrobeItem) {
  const value = text(item)
  return /rain|water|waterproof|resistant|coat|jacket|boots|shell|trench|nylon|polyester/.test(
    value,
  )
}

function isWarm(item: StylistWardrobeItem) {
  const value = text(item)
  return /winter|autumn|wool|fleece|knit|coat|jacket|hoodie|sweater|boot|warm|thermal/.test(
    value,
  )
}

function isHotWeatherOk(item: StylistWardrobeItem) {
  const value = text(item)
  return !/wool|fleece|thermal|puffer|heavy coat/.test(value)
}

function hasCategory(items: StylistWardrobeItem[], category: string) {
  return items.some((item) => item.category === category)
}

export function applyWeatherSuitability(
  items: StylistWardrobeItem[],
  forecast: WeatherForecast,
  requiredCategories: string[],
): WeatherSuitabilityResult {
  const signals = getWeatherSignals(forecast.current, forecast)
  let suitableItems = items

  if (signals.includes('hot')) {
    suitableItems = suitableItems.filter(isHotWeatherOk)
  }
  if (signals.includes('cold')) {
    suitableItems = suitableItems.filter(
      (item) =>
        item.category !== 'outerwear' ||
        isWarm(item) ||
        item.seasons.length === 0,
    )
  }
  if (signals.includes('rain') || signals.includes('snow')) {
    const weatherReady = suitableItems.filter(
      (item) => item.category !== 'outerwear' || isRainReady(item),
    )
    suitableItems = weatherReady.length > 0 ? weatherReady : suitableItems
  }

  const missingCategories = requiredCategories.filter(
    (category) => !hasCategory(suitableItems, category),
  )
  if (
    (signals.includes('rain') || signals.includes('snow')) &&
    !hasCategory(suitableItems, 'outerwear')
  ) {
    missingCategories.push('outerwear')
  }

  return {
    signals,
    suitableItems,
    missingCategories: Array.from(new Set(missingCategories)),
    explanation: signals.join(', '),
  }
}
