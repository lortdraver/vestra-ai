import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  outfit,
  outfitItem,
  wardrobeItem,
  wearLog,
  wearLogItem,
} from '@/lib/db/schema'
import { toWardrobeItemDto } from '@/lib/wardrobe/serialize'
import {
  calculateWardrobeInsights,
  getRangeStart,
  normalizeTimezone,
  normalizeWearDate,
  normalizeWearItemIds,
  type CreateWearLogInput,
  type WardrobeInsightsDto,
  type WearLogDto,
  type WearRange,
  type WearStats,
} from '@/lib/wear'
import { toIsoDate, toWearCount } from '@/lib/wear/normalization'

type WearLogRow = typeof wearLog.$inferSelect
type WardrobeItemRow = typeof wardrobeItem.$inferSelect

export class WearLogError extends Error {
  constructor(
    public code:
      | 'wear_log_target_required'
      | 'wear_log_duplicate'
      | 'wear_log_item_not_available'
      | 'wear_log_outfit_not_available'
      | 'wear_log_write_failed',
  ) {
    super(code)
  }
}

export async function getWearStatsForItems(
  userId: string,
  itemIds: string[],
): Promise<Map<string, WearStats>> {
  if (itemIds.length === 0) return new Map()

  const rows = await db
    .select({
      wardrobeItemId: wearLogItem.wardrobeItemId,
      totalWearCount: sql<number>`count(*)::int`,
      lastWornAt: sql<Date | string | null>`max(${wearLog.wornAt})`,
    })
    .from(wearLogItem)
    .innerJoin(wearLog, eq(wearLogItem.wearLogId, wearLog.id))
    .where(
      and(
        eq(wearLog.userId, userId),
        inArray(wearLogItem.wardrobeItemId, itemIds),
      ),
    )
    .groupBy(wearLogItem.wardrobeItemId)

  return new Map(
    rows.map((row) => [
      row.wardrobeItemId,
      {
        totalWearCount: toWearCount(row.totalWearCount),
        lastWornAt: toIsoDate(row.lastWornAt),
      },
    ]),
  )
}

export async function createWearLogForUser(
  userId: string,
  input: CreateWearLogInput,
) {
  const timezone = normalizeTimezone(input.timezone)
  const wornAt = normalizeWearDate(input.wornAt)

  if (input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(wearLog)
      .where(
        and(
          eq(wearLog.userId, userId),
          eq(wearLog.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1)

    if (existing) {
      const [existingDto] = await serializeWearLogs(userId, [existing])
      return existingDto
    }
  }

  let created: WearLogRow
  try {
    created = await db.transaction(async (tx) => {
      let itemIds = normalizeWearItemIds(input)
      const roleByItemId = new Map<string, string | null>()
      let source: 'item' | 'outfit' | 'manual' =
        itemIds.length === 1 ? 'item' : 'manual'

      if (input.outfitId) {
        const [ownedOutfit] = await tx
          .select()
          .from(outfit)
          .where(and(eq(outfit.id, input.outfitId), eq(outfit.userId, userId)))
          .limit(1)

        if (!ownedOutfit) {
          throw new WearLogError('wear_log_outfit_not_available')
        }

        const outfitItems = await tx
          .select()
          .from(outfitItem)
          .where(eq(outfitItem.outfitId, input.outfitId))

        itemIds = outfitItems.map((item) => item.wardrobeItemId)
        for (const item of outfitItems) {
          roleByItemId.set(item.wardrobeItemId, item.role)
        }
        source = 'outfit'
      }

      if (itemIds.length === 0) {
        throw new WearLogError('wear_log_target_required')
      }

      const ownedItems = await tx
        .select()
        .from(wardrobeItem)
        .where(
          and(
            eq(wardrobeItem.userId, userId),
            eq(wardrobeItem.imageDeletionStatus, 'active'),
            inArray(wardrobeItem.id, itemIds),
          ),
        )

      if (ownedItems.length !== itemIds.length) {
        throw new WearLogError('wear_log_item_not_available')
      }

      const [created] = await tx
        .insert(wearLog)
        .values({
          userId,
          outfitId: input.outfitId ?? null,
          wornAt,
          source,
          note: input.note ?? null,
          timezone,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning()

      await tx.insert(wearLogItem).values(
        itemIds.map((wardrobeItemId) => ({
          wearLogId: created.id,
          wardrobeItemId,
          role: roleByItemId.get(wardrobeItemId) ?? null,
        })),
      )

      return created
    })
  } catch (error) {
    if (
      input.idempotencyKey &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    ) {
      const [existing] = await db
        .select()
        .from(wearLog)
        .where(
          and(
            eq(wearLog.userId, userId),
            eq(wearLog.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)

      if (existing) {
        const [existingDto] = await serializeWearLogs(userId, [existing])
        return existingDto
      }
    }

    throw error
  }

  const [createdDto] = await serializeWearLogs(userId, [created])
  return createdDto
}

export async function listWearLogsForUser({
  userId,
  limit,
  offset,
  startDate,
  endDate,
  itemId,
  outfitId,
}: {
  userId: string
  limit: number
  offset: number
  startDate: Date | null
  endDate: Date | null
  itemId?: string | null
  outfitId?: string | null
}) {
  const itemLogIds = itemId
    ? (
        await db
          .select({ wearLogId: wearLogItem.wearLogId })
          .from(wearLogItem)
          .where(eq(wearLogItem.wardrobeItemId, itemId))
      ).map((row) => row.wearLogId)
    : null

  const logs = await db
    .select()
    .from(wearLog)
    .where(
      and(
        eq(wearLog.userId, userId),
        startDate ? gte(wearLog.wornAt, startDate) : undefined,
        endDate ? lte(wearLog.wornAt, endDate) : undefined,
        outfitId ? eq(wearLog.outfitId, outfitId) : undefined,
        itemLogIds ? inArray(wearLog.id, itemLogIds) : undefined,
      ),
    )
    .orderBy(desc(wearLog.wornAt))
    .limit(limit)
    .offset(offset)

  return serializeWearLogs(userId, logs)
}

export async function deleteWearLogForUser(userId: string, wearLogId: string) {
  const [deleted] = await db
    .delete(wearLog)
    .where(and(eq(wearLog.id, wearLogId), eq(wearLog.userId, userId)))
    .returning()

  return Boolean(deleted)
}

export async function getWardrobeInsightsForUser({
  userId,
  range,
  now = new Date(),
}: {
  userId: string
  range: WearRange
  now?: Date
}): Promise<WardrobeInsightsDto> {
  const activeItems = await db
    .select()
    .from(wardrobeItem)
    .where(
      and(
        eq(wardrobeItem.userId, userId),
        eq(wardrobeItem.imageDeletionStatus, 'active'),
      ),
    )

  const rangeStart = getRangeStart(range, now)
  const entries = await db
    .select({
      wardrobeItemId: wearLogItem.wardrobeItemId,
      wornAt: wearLog.wornAt,
    })
    .from(wearLogItem)
    .innerJoin(wearLog, eq(wearLogItem.wearLogId, wearLog.id))
    .where(
      and(
        eq(wearLog.userId, userId),
        rangeStart ? gte(wearLog.wornAt, rangeStart) : undefined,
      ),
    )

  const recentLogs = await db
    .select()
    .from(wearLog)
    .where(
      and(
        eq(wearLog.userId, userId),
        rangeStart ? gte(wearLog.wornAt, rangeStart) : undefined,
      ),
    )
    .orderBy(desc(wearLog.wornAt))
    .limit(10)

  const base = calculateWardrobeInsights({
    range,
    activeItems: activeItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      imageUrl: item.processedImageUrl ?? item.imageUrl,
    })),
    wearEntries: entries.map((entry) => ({
      wardrobeItemId: entry.wardrobeItemId,
      wornAt: entry.wornAt,
    })),
    now,
  })

  return {
    ...base,
    recentActivity: await serializeWearLogs(userId, recentLogs, activeItems),
  }
}

async function serializeWearLogs(
  userId: string,
  logs: WearLogRow[],
  knownWardrobeItems?: WardrobeItemRow[],
): Promise<WearLogDto[]> {
  if (logs.length === 0) return []

  const logIds = logs.map((log) => log.id)
  const logItems = await db
    .select()
    .from(wearLogItem)
    .where(inArray(wearLogItem.wearLogId, logIds))

  const itemIds = Array.from(
    new Set(logItems.map((item) => item.wardrobeItemId)),
  )
  const knownById = new Map(
    knownWardrobeItems?.map((item) => [item.id, item]) ?? [],
  )
  const missingItemIds = itemIds.filter((id) => !knownById.has(id))
  const fetchedItems =
    missingItemIds.length > 0
      ? await db
          .select()
          .from(wardrobeItem)
          .where(
            and(
              eq(wardrobeItem.userId, userId),
              inArray(wardrobeItem.id, missingItemIds),
            ),
          )
      : []
  const wardrobeById = new Map([
    ...knownById,
    ...fetchedItems.map((item) => [item.id, item] as const),
  ])

  return logs.map((log) => ({
    id: log.id,
    outfitId: log.outfitId,
    wornAt: log.wornAt.toISOString(),
    source: log.source as WearLogDto['source'],
    note: log.note,
    timezone: log.timezone,
    createdAt: log.createdAt.toISOString(),
    items: logItems
      .filter((item) => item.wearLogId === log.id)
      .map((item) => {
        const wardrobe = wardrobeById.get(item.wardrobeItemId)
        const dto = wardrobe ? toWardrobeItemDto(wardrobe) : null
        return {
          wardrobeItemId: item.wardrobeItemId,
          role: item.role,
          name: dto?.name ?? item.role ?? item.wardrobeItemId,
          imageUrl: dto?.imageUrl ?? '',
          category: dto?.category ?? 'other',
        }
      }),
  }))
}
