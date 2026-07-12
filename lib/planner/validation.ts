import { z } from 'zod'
import { normalizeTimezone, parseOptionalDate } from '@/lib/wear/validation'

const uuidSchema = z.string().uuid()
const statusSchema = z.enum(['planned', 'worn', 'skipped'])
const sourceSchema = z.enum([
  'manual',
  'stylist',
  'weather_suggestion',
  'calendar_import',
])

export const createOutfitPlanSchema = z.object({
  outfitId: uuidSchema.optional().nullable(),
  generationBatchId: uuidSchema.optional().nullable(),
  title: z.string().trim().min(1).max(160),
  occasion: z.string().trim().max(120).optional().nullable(),
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
