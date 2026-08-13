import { describe, expect, it } from 'vitest'
import {
  createOutfitPlanSchema,
  outfitPlanMetadataSchema,
  normalizePlanTimezone,
  parsePlanRange,
  plannerOccasionSchema,
} from '@/lib/planner/validation'
import { plannerCopy, plannerOccasions } from '@/lib/planner/copy'

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

  it('accepts canonical planner occasions', () => {
    expect(plannerOccasionSchema.parse('formal_event')).toBe('formal_event')
    expect(plannerOccasions).toContain('outdoor')
  })

  it('rejects non-canonical occasion values', () => {
    expect(plannerOccasionSchema.safeParse('random brunch').success).toBe(false)
  })

  it('accepts weather snapshots in plan metadata', () => {
    const metadata = outfitPlanMetadataSchema.parse({
      weatherSnapshot: {
        date: '2026-07-12',
        locationName: 'Baku',
        timezone: 'Asia/Baku',
        temperatureC: 16,
        feelsLikeC: 14,
        minTemperatureC: 13,
        maxTemperatureC: 18,
        precipitationProbability: 65,
        rainExpected: true,
        snowExpected: false,
        condition: 'rain',
        temperatureBand: 'cool',
        precipitation: 'rain',
      },
      weatherChange: {
        changed: true,
        reasons: ['rain_introduced'],
        temperatureDeltaC: 2,
      },
    })

    expect(metadata.weatherSnapshot?.precipitation).toBe('rain')
    expect(metadata.weatherChange?.changed).toBe(true)
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

  it('contains localized planner copy for every supported locale', () => {
    expect(plannerCopy.az.weatherChanged).toContain('Hava')
    expect(plannerCopy.en.weatherChanged).toContain('Weather')
    expect(plannerCopy.ru.weatherChanged).toContain('Погода')
  })
})
