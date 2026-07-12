export type WearSource = 'item' | 'outfit' | 'manual'

export type WearLogDto = {
  id: string
  outfitId: string | null
  wornAt: string
  source: WearSource
  note: string | null
  timezone: string
  items: Array<{
    wardrobeItemId: string
    role: string | null
    name: string
    imageUrl: string
    category: string
  }>
  createdAt: string
}

export type WearStats = {
  totalWearCount: number
  lastWornAt: string | null
}

export type WearRange = '30' | '60' | '90' | 'all'

export type WardrobeInsightItem = {
  id: string
  name: string
  category: string
  imageUrl: string
  totalWearCount: number
  lastWornAt: string | null
}

export type WardrobeInsightsDto = {
  range: WearRange
  totalActiveItems: number
  uniqueItemsWorn: number
  utilizationPercentage: number
  totalRecordedWears: number
  mostWornItems: WardrobeInsightItem[]
  leastWornItems: WardrobeInsightItem[]
  neverWornItems: WardrobeInsightItem[]
  longUnused: Record<'30' | '60' | '90', WardrobeInsightItem[]>
  recentActivity: WearLogDto[]
  categoryUsage: Array<{
    category: string
    totalItems: number
    uniqueWorn: number
    totalWears: number
    utilizationPercentage: number
  }>
}
