import { and, desc, eq, gte, ilike, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  outfit,
  outfitGenerationBatch,
  outfitItem,
  outfitPlan,
  wardrobeItem,
} from '@/lib/db/schema'
import { createWearLogForUser } from '@/lib/wear/server'
import type { CreateOutfitPlanInput, PatchOutfitPlanInput } from './validation'
import { normalizePlanTimezone, toPlanDate } from './validation'
import type { OutfitPlanDto } from './types'

type PlanRow = typeof outfitPlan.$inferSelect

export class OutfitPlanError extends Error {
  constructor(
    public code:
      | 'not_found'
      | 'outfit_not_available'
      | 'generation_batch_not_available'
      | 'wardrobe_item_not_available'
      | 'duplicate_plan',
  ) {
    super(code)
  }
}

function numberOrNull(value: string | null) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function toOutfitPlanDto(row: PlanRow): OutfitPlanDto {
  return {
    id: row.id,
    outfitId: row.outfitId,
    generationBatchId: row.generationBatchId,
    title: row.title,
    occasion: row.occasion,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt?.toISOString() ?? null,
    allDay: row.allDay,
    timezone: row.timezone,
    locationName: row.locationName,
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    note: row.note,
    status: row.status as OutfitPlanDto['status'],
    source: row.source as OutfitPlanDto['source'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function assertOutfitSafe(userId: string, outfitId: string) {
  const [ownedOutfit] = await db
    .select()
    .from(outfit)
    .where(and(eq(outfit.id, outfitId), eq(outfit.userId, userId)))
    .limit(1)

  if (!ownedOutfit) throw new OutfitPlanError('outfit_not_available')

  const items = await db
    .select()
    .from(outfitItem)
    .where(
      and(eq(outfitItem.outfitId, outfitId), eq(outfitItem.userId, userId)),
    )

  if (items.length === 0)
    throw new OutfitPlanError('wardrobe_item_not_available')

  const wardrobeRows = await db
    .select()
    .from(wardrobeItem)
    .where(and(eq(wardrobeItem.userId, userId)))
  const activeIds = new Set(
    wardrobeRows
      .filter((item) => item.imageDeletionStatus === 'active')
      .map((item) => item.id),
  )
  if (items.some((item) => !activeIds.has(item.wardrobeItemId))) {
    throw new OutfitPlanError('wardrobe_item_not_available')
  }
}

async function assertGenerationBatchSafe(userId: string, batchId: string) {
  const [batch] = await db
    .select()
    .from(outfitGenerationBatch)
    .where(
      and(
        eq(outfitGenerationBatch.id, batchId),
        eq(outfitGenerationBatch.userId, userId),
      ),
    )
    .limit(1)

  if (!batch) throw new OutfitPlanError('generation_batch_not_available')
}

async function assertPlanReferences(
  userId: string,
  input: {
    outfitId?: string | null
    generationBatchId?: string | null
  },
) {
  if (input.outfitId) await assertOutfitSafe(userId, input.outfitId)
  if (input.generationBatchId) {
    await assertGenerationBatchSafe(userId, input.generationBatchId)
  }
}

export async function createOutfitPlanForUser(
  userId: string,
  input: CreateOutfitPlanInput,
) {
  await assertPlanReferences(userId, input)

  const startAt = toPlanDate(input.startAt)
  const endAt = input.endAt ? toPlanDate(input.endAt) : null
  const [duplicate] = await db
    .select()
    .from(outfitPlan)
    .where(
      and(
        eq(outfitPlan.userId, userId),
        eq(outfitPlan.title, input.title),
        eq(outfitPlan.startAt, startAt),
      ),
    )
    .limit(1)
  if (duplicate) throw new OutfitPlanError('duplicate_plan')

  const [created] = await db
    .insert(outfitPlan)
    .values({
      userId,
      outfitId: input.outfitId ?? null,
      generationBatchId: input.generationBatchId ?? null,
      title: input.title,
      occasion: input.occasion ?? null,
      startAt,
      endAt,
      allDay: input.allDay,
      timezone: normalizePlanTimezone(input.timezone),
      locationName: input.locationName ?? null,
      latitude: input.latitude == null ? null : String(input.latitude),
      longitude: input.longitude == null ? null : String(input.longitude),
      note: input.note ?? null,
      status: input.status,
      source: input.source,
    })
    .returning()

  return toOutfitPlanDto(created)
}

export async function listOutfitPlansForUser(input: {
  userId: string
  startDate: Date | null
  endDate: Date | null
  status?: string | null
  occasion?: string | null
}) {
  const rows = await db
    .select()
    .from(outfitPlan)
    .where(
      and(
        eq(outfitPlan.userId, input.userId),
        input.startDate ? gte(outfitPlan.startAt, input.startDate) : undefined,
        input.endDate ? lte(outfitPlan.startAt, input.endDate) : undefined,
        input.status ? eq(outfitPlan.status, input.status) : undefined,
        input.occasion
          ? ilike(outfitPlan.occasion, `%${input.occasion}%`)
          : undefined,
      ),
    )
    .orderBy(desc(outfitPlan.startAt))
    .limit(100)

  return rows.map(toOutfitPlanDto)
}

export async function getOutfitPlanForUser(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(outfitPlan)
    .where(and(eq(outfitPlan.id, id), eq(outfitPlan.userId, userId)))
    .limit(1)
  if (!row) throw new OutfitPlanError('not_found')
  return toOutfitPlanDto(row)
}

export async function updateOutfitPlanForUser(
  userId: string,
  id: string,
  input: PatchOutfitPlanInput,
) {
  const existing = await getOutfitPlanForUser(userId, id)
  await assertPlanReferences(userId, input)

  const patch = {
    ...input,
    startAt: input.startAt ? toPlanDate(input.startAt) : undefined,
    endAt:
      input.endAt === null
        ? null
        : input.endAt
          ? toPlanDate(input.endAt)
          : undefined,
    timezone: input.timezone
      ? normalizePlanTimezone(input.timezone)
      : undefined,
    latitude:
      input.latitude === null
        ? null
        : input.latitude == null
          ? undefined
          : String(input.latitude),
    longitude:
      input.longitude === null
        ? null
        : input.longitude == null
          ? undefined
          : String(input.longitude),
    updatedAt: new Date(),
  }

  const [updated] = await db
    .update(outfitPlan)
    .set(patch)
    .where(and(eq(outfitPlan.id, id), eq(outfitPlan.userId, userId)))
    .returning()

  if (!updated) throw new OutfitPlanError('not_found')

  if (
    existing.status !== 'worn' &&
    input.status === 'worn' &&
    updated.outfitId
  ) {
    await createWearLogForUser(userId, {
      outfitId: updated.outfitId ?? undefined,
      wornAt: updated.startAt.toISOString(),
      note: updated.note ?? undefined,
      timezone: updated.timezone,
      idempotencyKey: `plan:${updated.id}`,
    })
  }

  return toOutfitPlanDto(updated)
}

export async function deleteOutfitPlanForUser(userId: string, id: string) {
  const [deleted] = await db
    .delete(outfitPlan)
    .where(and(eq(outfitPlan.id, id), eq(outfitPlan.userId, userId)))
    .returning()

  if (!deleted) throw new OutfitPlanError('not_found')
  return true
}
