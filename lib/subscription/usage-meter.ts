import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscriptionUsage } from '@/lib/db/schema'
import { EntitlementError, getUserEntitlements } from './entitlements'
import { getCurrentMonthWindow } from './server'
import type { SubscriptionUsageKey } from './types'

export type MeteredUsageKey = Extract<
  SubscriptionUsageKey,
  'ai_analyses_monthly' | 'background_removals_monthly'
>

export function canConsumeUsage(used: number, limit: number | null) {
  return limit === null || used < limit
}

/**
 * Atomically records one unit of a monthly-metered, cost-bearing feature.
 * Throws EntitlementError('plan_limit_reached') when the plan limit is used up.
 *
 * A transaction-scoped advisory lock per (user, feature) serialises concurrent
 * requests, so two parallel uploads cannot both pass a check at limit - 1.
 * No unique index is required on subscription_usage.
 */
export async function consumeMonthlyUsage(
  userId: string,
  featureKey: MeteredUsageKey,
  now = new Date(),
) {
  const entitlements = await getUserEntitlements(userId, now)
  const limit = entitlements.plan.limits[featureKey]
  const { periodStart, periodEnd } = getCurrentMonthWindow(now)

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${userId}:${featureKey}`}))`,
    )

    const [row] = await tx
      .select({ id: subscriptionUsage.id, used: subscriptionUsage.used })
      .from(subscriptionUsage)
      .where(
        and(
          eq(subscriptionUsage.userId, userId),
          eq(subscriptionUsage.featureKey, featureKey),
          gte(subscriptionUsage.periodStart, periodStart),
          lt(subscriptionUsage.periodStart, periodEnd),
        ),
      )
      .limit(1)

    const used = row?.used ?? 0
    if (!canConsumeUsage(used, limit)) {
      throw new EntitlementError('plan_limit_reached', featureKey, limit, used)
    }

    if (row) {
      await tx
        .update(subscriptionUsage)
        .set({ used: used + 1, limitValue: limit, updatedAt: now })
        .where(eq(subscriptionUsage.id, row.id))
    } else {
      await tx.insert(subscriptionUsage).values({
        userId,
        featureKey,
        periodStart,
        periodEnd,
        used: 1,
        limitValue: limit,
      })
    }

    return { used: used + 1, limit }
  })
}
