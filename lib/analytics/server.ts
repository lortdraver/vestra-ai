import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  inArray,
  lt,
  sql,
} from 'drizzle-orm'
import { db } from '@/lib/db'
import { analyticsEvent, user } from '@/lib/db/schema'
import {
  analyticsEventPropertySchemas,
  type AnalyticsEventInput,
  type AnalyticsEventName,
} from './events'
import { sanitizeAnalyticsPath, sanitizeAnalyticsProperties } from './sanitize'

function logAnalyticsFailure(error: unknown, eventName?: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[analytics] event write failed', {
      eventName,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

export async function writeServerEvent(input: AnalyticsEventInput) {
  const sanitized = sanitizeAnalyticsProperties(input.properties)
  const sanitizedContext = sanitizeAnalyticsProperties(input.context)
  if (
    sanitized.rejectedKeys.length > 0 ||
    sanitizedContext.rejectedKeys.length > 0
  ) {
    logAnalyticsFailure(new Error('forbidden_property'), input.eventName)
    return false
  }
  const parsedProperties = analyticsEventPropertySchemas[
    input.eventName
  ].safeParse(sanitized.properties)
  if (!parsedProperties.success) {
    logAnalyticsFailure(new Error('invalid_event_properties'), input.eventName)
    return false
  }
  try {
    await db.insert(analyticsEvent).values({
      eventName: input.eventName,
      userId: input.userId ?? null,
      anonymousId: input.anonymousId ?? null,
      sessionId: input.sessionId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      source: 'server',
      locale: input.locale ?? null,
      path: sanitizeAnalyticsPath(input.path),
      planKey: input.planKey ?? null,
      dedupeKey: input.dedupeKey ?? null,
      properties: parsedProperties.data,
      context: sanitizedContext.properties,
    })
    return true
  } catch (error) {
    logAnalyticsFailure(error, input.eventName)
    return false
  }
}

export async function trackServerEvent(input: AnalyticsEventInput) {
  return writeServerEvent(input)
}

export type AnalyticsRange = { from: Date; to: Date }
function rangeWhere(range: AnalyticsRange) {
  return and(
    gte(analyticsEvent.occurredAt, range.from),
    lt(analyticsEvent.occurredAt, range.to),
  )
}

export async function countEventsByRange(
  range: AnalyticsRange,
  eventName?: AnalyticsEventName,
) {
  const [row] = await db
    .select({ count: count() })
    .from(analyticsEvent)
    .where(
      and(
        rangeWhere(range),
        eventName ? eq(analyticsEvent.eventName, eventName) : undefined,
      ),
    )
  return Number(row?.count ?? 0)
}

export async function countActiveUsersByRange(range: AnalyticsRange) {
  const [row] = await db
    .select({ count: countDistinct(analyticsEvent.userId) })
    .from(analyticsEvent)
    .where(and(rangeWhere(range), sql`${analyticsEvent.userId} is not null`))
  return Number(row?.count ?? 0)
}

export async function getDailyActiveUsers(now = new Date()) {
  return countActiveUsersByRange({
    from: new Date(now.getTime() - 86400000),
    to: now,
  })
}

export async function getWeeklyActiveUsers(now = new Date()) {
  return countActiveUsersByRange({
    from: new Date(now.getTime() - 7 * 86400000),
    to: now,
  })
}

export async function getMonthlyActiveUsers(now = new Date()) {
  return countActiveUsersByRange({
    from: new Date(now.getTime() - 30 * 86400000),
    to: now,
  })
}

export async function countActivatedUsers(range: AnalyticsRange) {
  const [row] = await db
    .select({ count: countDistinct(analyticsEvent.userId) })
    .from(analyticsEvent)
    .innerJoin(user, eq(user.id, analyticsEvent.userId))
    .where(
      and(
        rangeWhere(range),
        eq(analyticsEvent.eventName, 'first_wardrobe_item_created'),
        eq(user.emailVerified, true),
        sql`${analyticsEvent.userId} is not null`,
      ),
    )
  return Number(row?.count ?? 0)
}

export async function getProductMetrics(range: AnalyticsRange) {
  const names = {
    wardrobeItemsCreated: 'wardrobe_item_created',
    stylistGenerations: 'stylist_generation_completed',
    stylistFailures: 'stylist_generation_failed',
    analysisFailures: 'wardrobe_item_analysis_failed',
    outfitsCreated: 'outfit_created',
    plannerUsage: 'planner_outfit_scheduled',
  } as const
  const entries = await Promise.all(
    Object.entries(names).map(
      async ([key, eventName]) =>
        [key, await countEventsByRange(range, eventName)] as const,
    ),
  )
  return {
    activeUsers: await countActiveUsersByRange(range),
    ...Object.fromEntries(entries),
  }
}

export async function getRetentionCounts(input: {
  cohortFrom: Date
  cohortTo: Date
}) {
  const cohortRows = await db
    .select({ userId: analyticsEvent.userId })
    .from(analyticsEvent)
    .where(
      and(
        gte(analyticsEvent.occurredAt, input.cohortFrom),
        lt(analyticsEvent.occurredAt, input.cohortTo),
        sql`${analyticsEvent.userId} is not null`,
      ),
    )
  const cohortUserIds = new Set(
    cohortRows.flatMap((row) => (row.userId ? [row.userId] : [])),
  )
  const cohortIds = Array.from(cohortUserIds)
  const result: Record<'d1' | 'd7' | 'd30', number> = { d1: 0, d7: 0, d30: 0 }
  if (cohortIds.length === 0) return { cohortSize: 0, ...result }

  for (const [key, days] of Object.entries({ d1: 1, d7: 7, d30: 30 }) as Array<
    ['d1' | 'd7' | 'd30', number]
  >) {
    const activeRows = await db
      .select({ userId: analyticsEvent.userId })
      .from(analyticsEvent)
      .where(
        and(
          gte(
            analyticsEvent.occurredAt,
            new Date(input.cohortFrom.getTime() + days * 86400000),
          ),
          lt(
            analyticsEvent.occurredAt,
            new Date(input.cohortFrom.getTime() + (days + 1) * 86400000),
          ),
          inArray(analyticsEvent.userId, cohortIds),
        ),
      )
    result[key] = new Set(
      activeRows.flatMap((row) => (row.userId ? [row.userId] : [])),
    ).size
  }
  return { cohortSize: cohortIds.length, ...result }
}
