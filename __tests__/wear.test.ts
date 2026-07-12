import { describe, expect, it } from 'vitest'
import { toIsoDate, toWearCount } from '@/lib/wear/normalization'
import { toWardrobeItemDto } from '@/lib/wardrobe/serialize'
import {
  calculateUtilization,
  calculateWardrobeInsights,
  createWearLogSchema,
  getRangeStart,
  normalizeTimezone,
  normalizeWearDate,
  normalizeWearItemIds,
} from '@/lib/wear'

const now = new Date('2026-07-11T08:00:00.000Z')

function item(id: string, category: string) {
  return {
    id,
    name: `${category} ${id}`,
    category,
    imageUrl: `/images/${id}.webp`,
  }
}

describe('wear tracking validation', () => {
  it('accepts one item requests', () => {
    const parsed = createWearLogSchema.safeParse({
      wardrobeItemId: '11111111-1111-4111-8111-111111111111',
      timezone: 'Asia/Baku',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts multiple item requests and deduplicates ids', () => {
    const parsed = createWearLogSchema.parse({
      wardrobeItemIds: [
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    })

    expect(normalizeWearItemIds(parsed)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ])
  })

  it('accepts outfit requests', () => {
    const parsed = createWearLogSchema.safeParse({
      outfitId: '33333333-3333-4333-8333-333333333333',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects empty requests', () => {
    const parsed = createWearLogSchema.safeParse({})

    expect(parsed.success).toBe(false)
  })

  it('normalizes valid and invalid timezones', () => {
    expect(normalizeTimezone('Asia/Baku')).toBe('Asia/Baku')
    expect(normalizeTimezone('Invalid/Zone')).toBe('UTC')
  })

  it('stores historical dates as provided instants', () => {
    expect(
      normalizeWearDate('2026-07-10T20:00:00.000Z', now).toISOString(),
    ).toBe('2026-07-10T20:00:00.000Z')
  })
})

describe('wardrobe insights', () => {
  it('calculates utilization and total recorded item wears', () => {
    const insights = calculateWardrobeInsights({
      range: '30',
      activeItems: [item('top', 'tops'), item('bottom', 'bottoms')],
      wearEntries: [
        { wardrobeItemId: 'top', wornAt: now },
        { wardrobeItemId: 'top', wornAt: now },
      ],
      now,
    })

    expect(insights.totalActiveItems).toBe(2)
    expect(insights.uniqueItemsWorn).toBe(1)
    expect(insights.utilizationPercentage).toBe(50)
    expect(insights.totalRecordedWears).toBe(2)
  })

  it('identifies never-worn, most-worn, least-worn, and category usage', () => {
    const insights = calculateWardrobeInsights({
      range: 'all',
      activeItems: [
        item('top', 'tops'),
        item('bottom', 'bottoms'),
        item('shoe', 'shoes'),
      ],
      wearEntries: [
        { wardrobeItemId: 'top', wornAt: now },
        { wardrobeItemId: 'top', wornAt: now },
        { wardrobeItemId: 'bottom', wornAt: now },
      ],
      now,
    })

    expect(insights.mostWornItems[0]?.id).toBe('top')
    expect(insights.leastWornItems[0]?.id).toBe('bottom')
    expect(insights.neverWornItems.map((entry) => entry.id)).toEqual(['shoe'])
    expect(
      insights.categoryUsage.find((entry) => entry.category === 'tops')
        ?.utilizationPercentage,
    ).toBe(100)
  })

  it('calculates 30, 60, and 90 day long-unused buckets', () => {
    const insights = calculateWardrobeInsights({
      range: '90',
      activeItems: [item('recent', 'tops'), item('old', 'bottoms')],
      wearEntries: [
        { wardrobeItemId: 'recent', wornAt: new Date('2026-07-01T00:00:00Z') },
        { wardrobeItemId: 'old', wornAt: new Date('2026-03-01T00:00:00Z') },
      ],
      now,
    })

    expect(insights.longUnused['30'].map((entry) => entry.id)).toContain('old')
    expect(insights.longUnused['60'].map((entry) => entry.id)).toContain('old')
    expect(insights.longUnused['90'].map((entry) => entry.id)).toContain('old')
  })

  it('returns zero utilization for an empty wardrobe', () => {
    expect(calculateUtilization(0, 0)).toBe(0)
  })

  it('calculates range start dates', () => {
    expect(getRangeStart('30', now)?.toISOString()).toBe(
      '2026-06-11T08:00:00.000Z',
    )
    expect(getRangeStart('all', now)).toBeNull()
  })
})

describe('wardrobe DTO wear aggregates', () => {
  it('adds wear summary fields without requiring old clients to send them', () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      name: 'Grey tee',
      category: 'tops',
      clothingType: 't-shirt',
      colors: ['grey'],
      seasons: ['summer'],
      styles: ['casual'],
      material: '',
      brand: '',
      notes: '',
      imageUrl: '/tee.webp',
      imageStorageKey: 'tee.webp',
      imageContentType: 'image/webp',
      imageSize: '10',
      imageColorHints: null,
      originalImageUrl: null,
      originalImageStorageKey: null,
      originalImageContentType: null,
      originalImageSize: null,
      processedImageUrl: null,
      processedImageStorageKey: null,
      processedImageContentType: null,
      processedImageSize: null,
      backgroundRemovalStatus: 'done',
      backgroundRemovalProvider: null,
      backgroundRemovalModelId: null,
      imageDeletionStatus: 'active',
      imageDeleteRequestedAt: null,
      analysisStatus: 'pending',
      aiAnalysis: null,
      userCorrections: null,
      analysisError: null,
      analysisPromptVersion: null,
      analysisModelId: null,
      analyzedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const dto = toWardrobeItemDto(row, {
      totalWearCount: 1,
      lastWornAt: '2026-07-01T00:00:00.000Z',
    })

    expect(dto.wearCount).toBe(1)
    expect(dto.neverWorn).toBe(false)
    expect(dto.lastWornAt).toBe('2026-07-01T00:00:00.000Z')
  })
})

describe('wear aggregate normalization', () => {
  it('normalizes lastWornAt from a Date', () => {
    expect(toIsoDate(new Date('2026-07-01T10:30:00.000Z'))).toBe(
      '2026-07-01T10:30:00.000Z',
    )
  })

  it('normalizes lastWornAt from an ISO string', () => {
    expect(toIsoDate('2026-07-01T10:30:00.000Z')).toBe(
      '2026-07-01T10:30:00.000Z',
    )
  })

  it('normalizes lastWornAt from a PostgreSQL timestamp string', () => {
    expect(toIsoDate('2026-07-01 10:30:00+00')).toBe('2026-07-01T10:30:00.000Z')
  })

  it('returns null for null lastWornAt', () => {
    expect(toIsoDate(null)).toBeNull()
  })

  it('returns null for invalid lastWornAt values', () => {
    expect(toIsoDate('not-a-date')).toBeNull()
  })

  it('normalizes totalWearCount from a number', () => {
    expect(toWearCount(3)).toBe(3)
  })

  it('normalizes totalWearCount from a string', () => {
    expect(toWearCount('4')).toBe(4)
  })

  it('defaults null totalWearCount to zero', () => {
    expect(toWearCount(null)).toBe(0)
  })

  it('defaults invalid totalWearCount to zero', () => {
    expect(toWearCount('not-a-count')).toBe(0)
  })
})
