import type { WeatherSnapshot } from '@/lib/weather/types'

export type OutfitPlanStatus = 'planned' | 'worn' | 'skipped'
export type OutfitPlanSource =
  'manual' | 'stylist' | 'weather_suggestion' | 'calendar_import'

export type PlannerOccasion =
  | 'everyday'
  | 'university'
  | 'work'
  | 'business'
  | 'date'
  | 'dinner'
  | 'party'
  | 'sport'
  | 'travel'
  | 'outdoor'
  | 'formal_event'

export type OutfitPlanWeatherSnapshot = WeatherSnapshot

export type OutfitPlanWeatherChange = {
  changed: boolean
  reasons: string[]
  temperatureDeltaC: number
}

export type OutfitPlanDto = {
  id: string
  outfitId: string | null
  generationBatchId: string | null
  title: string
  occasion: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  timezone: string
  locationName: string | null
  latitude: number | null
  longitude: number | null
  note: string | null
  status: OutfitPlanStatus
  source: OutfitPlanSource
  weatherSnapshot: OutfitPlanWeatherSnapshot | null
  weatherChange: OutfitPlanWeatherChange | null
  wornLoggedAt: string | null
  createdAt: string
  updatedAt: string
}
