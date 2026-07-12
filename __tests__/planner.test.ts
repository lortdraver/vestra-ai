import { describe, expect, it } from 'vitest'
import {
  createOutfitPlanSchema,
  normalizePlanTimezone,
  parsePlanRange,
} from '@/lib/planner/validation'

describe('outfit planner validation', () => {
  it('accepts all-day plans with timezone-safe dates', () => {
    const parsed = createOutfitPlanSchema.parse({
      title: 'Work outfit',
      startAt: '2026-07-12T08:00:00.000Z',
      allDay: true,
      timezone: 'Asia/Baku',
    })

    expect(parsed.allDay).toBe(true)
    expect(normalizePlanTimezone(parsed.timezone)).toBe('Asia/Baku')
  })

  it('rejects missing titles', () => {
    expect(
      createOutfitPlanSchema.safeParse({
        title: '',
        startAt: '2026-07-12T08:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('parses plan date ranges', () => {
    const range = parsePlanRange({
      startDate: '2026-07-12T00:00:00.000Z',
      endDate: '2026-07-19T00:00:00.000Z',
    })

    expect(range.startDate?.toISOString()).toBe('2026-07-12T00:00:00.000Z')
    expect(range.endDate?.toISOString()).toBe('2026-07-19T00:00:00.000Z')
  })
})
