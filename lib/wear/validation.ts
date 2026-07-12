import { z } from 'zod'
import type { WearRange } from './types'

const uuidSchema = z.string().uuid()

export const createWearLogSchema = z
  .object({
    wardrobeItemId: uuidSchema.optional(),
    wardrobeItemIds: z.array(uuidSchema).max(30).optional(),
    outfitId: uuidSchema.optional(),
    wornAt: z.string().datetime().optional(),
    note: z.string().trim().max(280).optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .refine(
    (value) =>
      Boolean(value.outfitId) ||
      Boolean(value.wardrobeItemId) ||
      Boolean(value.wardrobeItemIds?.length),
    { message: 'wear_log_target_required' },
  )

export type CreateWearLogInput = z.infer<typeof createWearLogSchema>

export function parseWearRange(value: string | null): WearRange {
  return value === '60' || value === '90' || value === 'all' ? value : '30'
}

export function getRangeStart(range: WearRange, now = new Date()) {
  if (range === 'all') return null

  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - Number(range))
  return start
}

export function parseOptionalDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeWearDate(value?: string, now = new Date()) {
  if (!value) return now

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? now : date
}

export function normalizeTimezone(value?: string | null) {
  if (!value) return 'UTC'

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value }).format(new Date())
    return value
  } catch {
    return 'UTC'
  }
}

export function normalizeWearItemIds(input: CreateWearLogInput) {
  return Array.from(
    new Set(
      [input.wardrobeItemId, ...(input.wardrobeItemIds ?? [])].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  )
}
