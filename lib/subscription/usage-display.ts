import { and, count, eq, gte, isNull, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { outfit, outfitRequest, wardrobeItem } from '@/lib/db/schema'
import { getSubscriptionUsageMeters } from './plans'
import type {
  SubscriptionSnapshot,
  SubscriptionUsageKey,
  SubscriptionUsageMeter,
  SubscriptionUsageSnapshot,
} from './types'

export function getCurrentMonthWindow(now = new Date()) {
  return {
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
    periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }
}

function createUsageCopy(usage: SubscriptionUsageSnapshot) {
  return { ...usage }
}

async function countRows<T>(query: Promise<T[]>) {
  const [row] = (await query) as Array<{ value: number | string | null }>
  const value = Number(row?.value ?? 0)
  return Number.isFinite(value) ? value : 0
}

export async function getAuthoritativeSubscriptionUsage(
  userId: string,
  snapshot: SubscriptionSnapshot,
  now = new Date(),
): Promise<SubscriptionUsageSnapshot> {
  const { periodStart, periodEnd } = getCurrentMonthWindow(now)
  const [wardrobeItems, aiAnalyses, stylistRequests, savedOutfits] =
    await Promise.all([
      countRows(
        db
          .select({ value: count() })
          .from(wardrobeItem)
          .where(
            and(
              eq(wardrobeItem.userId, userId),
              eq(wardrobeItem.imageDeletionStatus, 'active'),
            ),
          ),
      ),
      countRows(
        db
          .select({ value: count() })
          .from(wardrobeItem)
          .where(
            and(
              eq(wardrobeItem.userId, userId),
              eq(wardrobeItem.analysisStatus, 'done'),
              gte(wardrobeItem.analyzedAt, periodStart),
              lt(wardrobeItem.analyzedAt, periodEnd),
            ),
          ),
      ),
      countRows(
        db
          .select({ value: count() })
          .from(outfitRequest)
          .where(
            and(
              eq(outfitRequest.userId, userId),
              gte(outfitRequest.createdAt, periodStart),
              lt(outfitRequest.createdAt, periodEnd),
            ),
          ),
      ),
      countRows(
        db
          .select({ value: count() })
          .from(outfit)
          .where(
            and(
              eq(outfit.userId, userId),
              eq(outfit.isSaved, true),
              isNull(outfit.deletedAt),
            ),
          ),
      ),
    ])

  const usage = createUsageCopy(snapshot.usage)
  usage.wardrobe_items = wardrobeItems
  usage.ai_analyses_monthly = Math.max(usage.ai_analyses_monthly, aiAnalyses)
  usage.stylist_requests_monthly = Math.max(
    usage.stylist_requests_monthly,
    stylistRequests,
  )
  usage.saved_outfits = savedOutfits

  return usage
}

export async function getSubscriptionUsageDisplayMeters({
  userId,
  subscription,
  features,
  now = new Date(),
}: {
  userId: string
  subscription: SubscriptionSnapshot
  features?: readonly SubscriptionUsageKey[]
  now?: Date
}): Promise<SubscriptionUsageMeter[]> {
  const usage = await getAuthoritativeSubscriptionUsage(
    userId,
    subscription,
    now,
  )
  const { periodEnd } = getCurrentMonthWindow(now)
  const meters = getSubscriptionUsageMeters(
    { plan: subscription.plan, usage },
    periodEnd,
  )

  if (!features) return meters
  return meters.filter((meter) => features.includes(meter.feature))
}
