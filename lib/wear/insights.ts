import type {
  WardrobeInsightsDto,
  WardrobeInsightItem,
  WearRange,
} from './types'

export type WearInsightWardrobeItem = {
  id: string
  name: string
  category: string
  imageUrl: string
}

export type WearInsightEntry = {
  wardrobeItemId: string
  wornAt: Date
}

function toInsightItem(
  item: WearInsightWardrobeItem,
  stats: { totalWearCount: number; lastWornAt: Date | null },
): WardrobeInsightItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    imageUrl: item.imageUrl,
    totalWearCount: stats.totalWearCount,
    lastWornAt: stats.lastWornAt?.toISOString() ?? null,
  }
}

export function calculateUtilization(uniqueWorn: number, totalActive: number) {
  if (totalActive === 0) return 0
  return Math.round((uniqueWorn / totalActive) * 100)
}

export function calculateWardrobeInsights({
  range,
  activeItems,
  wearEntries,
  now = new Date(),
}: {
  range: WearRange
  activeItems: WearInsightWardrobeItem[]
  wearEntries: WearInsightEntry[]
  now?: Date
}): Omit<WardrobeInsightsDto, 'recentActivity'> {
  const itemById = new Map(activeItems.map((item) => [item.id, item]))
  const statsByItem = new Map<
    string,
    { totalWearCount: number; lastWornAt: Date | null }
  >()

  for (const item of activeItems) {
    statsByItem.set(item.id, { totalWearCount: 0, lastWornAt: null })
  }

  for (const entry of wearEntries) {
    if (!itemById.has(entry.wardrobeItemId)) continue
    const stats = statsByItem.get(entry.wardrobeItemId)
    if (!stats) continue
    stats.totalWearCount += 1
    if (!stats.lastWornAt || entry.wornAt > stats.lastWornAt) {
      stats.lastWornAt = entry.wornAt
    }
  }

  const items = activeItems.map((item) =>
    toInsightItem(
      item,
      statsByItem.get(item.id) ?? { totalWearCount: 0, lastWornAt: null },
    ),
  )
  const wornItems = items.filter((item) => item.totalWearCount > 0)
  const neverWornItems = items.filter((item) => item.totalWearCount === 0)

  const longUnused = {
    '30': getLongUnusedItems(items, now, 30),
    '60': getLongUnusedItems(items, now, 60),
    '90': getLongUnusedItems(items, now, 90),
  }

  const categoryMap = new Map<
    string,
    { totalItems: number; uniqueWorn: number; totalWears: number }
  >()
  for (const item of items) {
    const current = categoryMap.get(item.category) ?? {
      totalItems: 0,
      uniqueWorn: 0,
      totalWears: 0,
    }
    current.totalItems += 1
    if (item.totalWearCount > 0) current.uniqueWorn += 1
    current.totalWears += item.totalWearCount
    categoryMap.set(item.category, current)
  }

  return {
    range,
    totalActiveItems: activeItems.length,
    uniqueItemsWorn: wornItems.length,
    utilizationPercentage: calculateUtilization(
      wornItems.length,
      activeItems.length,
    ),
    totalRecordedWears: wearEntries.length,
    mostWornItems: [...wornItems]
      .sort((a, b) => b.totalWearCount - a.totalWearCount)
      .slice(0, 6),
    leastWornItems: [...wornItems]
      .sort((a, b) => a.totalWearCount - b.totalWearCount)
      .slice(0, 6),
    neverWornItems: neverWornItems.slice(0, 12),
    longUnused,
    categoryUsage: [...categoryMap.entries()]
      .map(([category, value]) => ({
        category,
        ...value,
        utilizationPercentage: calculateUtilization(
          value.uniqueWorn,
          value.totalItems,
        ),
      }))
      .sort((a, b) => b.totalWears - a.totalWears),
  }
}

function getLongUnusedItems(
  items: WardrobeInsightItem[],
  now: Date,
  days: number,
) {
  const threshold = now.getTime() - days * 86_400_000
  return items
    .filter((item) => {
      if (!item.lastWornAt) return true
      return new Date(item.lastWornAt).getTime() < threshold
    })
    .slice(0, 12)
}
