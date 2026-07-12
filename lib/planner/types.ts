export type OutfitPlanStatus = 'planned' | 'worn' | 'skipped'
export type OutfitPlanSource =
  'manual' | 'stylist' | 'weather_suggestion' | 'calendar_import'

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
  createdAt: string
  updatedAt: string
}
