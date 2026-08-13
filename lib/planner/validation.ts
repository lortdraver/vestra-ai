import { z } from 'zod'
import { normalizeTimezone, parseOptionalDate } from '@/lib/wear/validation'

const uuidSchema = z.string().uuid()
const statusSchema = z.enum(['planned', 'worn', 'skipped'])
export const plannerOccasionSchema = z.enum([
  'everyday',
  'university',
  'work',
  'business',
  'date',
  'dinner',
  'party',
  'sport',
  'travel',
  'outdoor',
  'formal_event',
])
const sourceSchema = z.enum([
  'manual',
  'stylist',
  'weather_suggestion',
  'calendar_import',
])

const weatherSnapshotSchema = z.object({
  date: z.string().trim().min(1).max(40),
  locationName: z.string().trim().max(160),
  timezone: z.string().trim().max(80),
  temperatureC: z.number(),
  feelsLikeC: z.number(),
  minTemperatureC: z.number().nullable(),
  maxTemperatureC: z.number().nullable(),
  precipitationProbability: z.number().min(0).max(100),
  rainExpected: z.boolean(),
  snowExpected: z.boolean(),
  condition: z.enum([
    'clear',
    'cloudy',
    'rain',
    'snow',
    'storm',
    'wind',
    'unknown',
  ]),
  temperatureBand: z.enum(['freezing', 'cold', 'cool', 'mild', 'warm', 'hot']),
  precipitation: z.enum(['none', 'rain', 'snow']),
})

export const outfitPlanMetadataSchema = z
  .object({
    weatherSnapshot: weatherSnapshotSchema.optional().nullable(),
    weatherChange: z
      .object({
        changed: z.boolean(),
        reasons: z.array(z.string().trim().max(80)).max(8),
        temperatureDeltaC: z.number().min(0),
      })
      .optional()
      .nullable(),
    weatherSuitability: z
      .object({
        level: z.enum(['good', 'weak', 'too_warm', 'too_light', 'unknown']),
        message: z.string().trim().max(500),
      })
      .optional()
      .nullable(),
    wornLoggedAt: z.string().datetime().optional().nullable(),
  })
  .passthrough()

export const createOutfitPlanSchema = z.object({
  outfitId: uuidSchema.optional().nullable(),
  generationBatchId: uuidSchema.optional().nullable(),
  title: z.string().trim().min(1).max(160),
  occasion: plannerOccasionSchema.optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().default(false),
  timezone: z.string().trim().min(1).max(80).optional(),
  locationName: z.string().trim().max(160).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  status: statusSchema.default('planned'),
  source: sourceSchema.default('manual'),
  metadata: outfitPlanMetadataSchema.optional(),
})

export const patchOutfitPlanSchema = createOutfitPlanSchema.partial()

export const listOutfitPlansQuerySchema = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: statusSchema.optional().nullable(),
  occasion: z.string().trim().max(120).optional().nullable(),
})

export type CreateOutfitPlanInput = z.infer<typeof createOutfitPlanSchema>
export type PatchOutfitPlanInput = z.infer<typeof patchOutfitPlanSchema>

export function toPlanDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('invalid_plan_date')
  return date
}

export function normalizePlanTimezone(value?: string | null) {
  return normalizeTimezone(value)
}

export function parsePlanRange(input: {
  startDate?: string | null
  endDate?: string | null
}) {
  return {
    startDate: parseOptionalDate(input.startDate ?? null),
    endDate: parseOptionalDate(input.endDate ?? null),
  }
}
