import { and, count, eq, gte, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { outfit, outfitRequest, wardrobeItem } from '@/lib/db/schema'
import { checkUsage } from './plans'
import { getSubscriptionSnapshot } from './server'
import type { SubscriptionUsageKey } from './types'

export type EntitlementCode =
  | 'plan_limit_reached'
  | 'pro_required'
  | 'stylist_limit_reached'
  | 'wardrobe_limit_reached'
  | 'saved_outfit_limit_reached'

export class EntitlementError extends Error {
  constructor(
    public code: EntitlementCode,
    public feature: SubscriptionUsageKey | 'planner_adaptation',
    public limit: number | null,
    public used: number,
  ) {
    super(code)
  }
}

async function countRows<T>(query: Promise<T[]>) {
  const [row] = (await query) as Array<{ value: number }>
  return Number(row?.value ?? 0)
}

function weekWindow(now = new Date()) {
  return new Date(now.getTime() - 7 * 86400000)
}

export async function getUserEntitlements(userId: string, now = new Date()) {
  const snapshot = await getSubscriptionSnapshot(userId, now)
  return {
    ...snapshot,
    isPro: snapshot.isPremium,
    limits: snapshot.plan.limits,
  }
}

export async function assertWardrobeItemCreateAllowed(userId: string) {
  const entitlements = await getUserEntitlements(userId)
  const limit = entitlements.plan.limits.wardrobe_items
  if (limit === null) return entitlements

  const used = await countRows(
    db
      .select({ value: count() })
      .from(wardrobeItem)
      .where(
        and(
          eq(wardrobeItem.userId, userId),
          eq(wardrobeItem.imageDeletionStatus, 'active'),
        ),
      ),
  )
  if (used >= limit) {
    throw new EntitlementError(
      'wardrobe_limit_reached',
      'wardrobe_items',
      limit,
      used,
    )
  }
  return entitlements
}

export async function assertStylistGenerationAllowed(userId: string) {
  const entitlements = await getUserEntitlements(userId)
  const check = checkUsage(entitlements, 'stylist_requests_monthly')
  if (entitlements.isPro || check.limit === null) return entitlements

  const used = await countRows(
    db
      .select({ value: count() })
      .from(outfitRequest)
      .where(
        and(
          eq(outfitRequest.userId, userId),
          gte(outfitRequest.createdAt, weekWindow()),
        ),
      ),
  )
  const limit = entitlements.plan.limits.stylist_requests_monthly
  if (limit !== null && used >= limit) {
    throw new EntitlementError(
      'stylist_limit_reached',
      'stylist_requests_monthly',
      limit,
      used,
    )
  }
  return entitlements
}

export async function assertSavedOutfitAllowed(userId: string) {
  const entitlements = await getUserEntitlements(userId)
  const limit = entitlements.plan.limits.saved_outfits
  if (limit === null) return entitlements

  const used = await countRows(
    db
      .select({ value: count() })
      .from(outfit)
      .where(
        and(
          eq(outfit.userId, userId),
          isNull(outfit.deletedAt),
          eq(outfit.isSaved, true),
        ),
      ),
  )
  if (used >= limit) {
    throw new EntitlementError(
      'saved_outfit_limit_reached',
      'saved_outfits',
      limit,
      used,
    )
  }
  return entitlements
}

export async function assertPlannerAdaptationAllowed(userId: string) {
  const entitlements = await getUserEntitlements(userId)
  if (entitlements.isPro) return entitlements
  throw new EntitlementError('pro_required', 'planner_adaptation', null, 0)
}
