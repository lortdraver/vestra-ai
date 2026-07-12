import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscription, subscriptionUsage } from '@/lib/db/schema'
import { getSubscriptionPlan, isPremiumPlan, isTrialActive } from './plans'
import type {
  SubscriptionSnapshot,
  SubscriptionStatus,
  SubscriptionUsageKey,
  SubscriptionUsageSnapshot,
} from './types'

function getCurrentMonthWindow(now = new Date()) {
  return {
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
    periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }
}

function createEmptyUsage(): SubscriptionUsageSnapshot {
  return {
    wardrobe_items: 0,
    ai_analyses_monthly: 0,
    stylist_requests_monthly: 0,
    background_removals_monthly: 0,
    saved_outfits: 0,
  }
}

function toSubscriptionStatus(status: string | null | undefined) {
  return ['active', 'trialing', 'past_due', 'canceled', 'expired'].includes(
    status ?? '',
  )
    ? (status as SubscriptionStatus)
    : 'active'
}

export async function getSubscriptionSnapshot(
  userId: string,
  now = new Date(),
): Promise<SubscriptionSnapshot> {
  const [subscriptionRow] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.userId, userId))
    .orderBy(desc(subscription.createdAt))
    .limit(1)

  const plan = getSubscriptionPlan(subscriptionRow?.planKey)
  const { periodStart, periodEnd } = getCurrentMonthWindow(now)
  const usageRows = await db
    .select()
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.userId, userId),
        gte(subscriptionUsage.periodStart, periodStart),
        lt(subscriptionUsage.periodStart, periodEnd),
      ),
    )

  const usage = createEmptyUsage()
  for (const row of usageRows) {
    if (row.featureKey in usage) {
      usage[row.featureKey as SubscriptionUsageKey] = row.used
    }
  }

  const trialActive = isTrialActive(subscriptionRow?.trialEndsAt, now)

  return {
    plan,
    status: toSubscriptionStatus(subscriptionRow?.status),
    isPremium: isPremiumPlan(subscriptionRow?.planKey) || trialActive,
    isTrialActive: trialActive,
    trialEndsAt: subscriptionRow?.trialEndsAt ?? null,
    usage,
  }
}

export function getFallbackSubscriptionSnapshot(): SubscriptionSnapshot {
  return {
    plan: getSubscriptionPlan('free'),
    status: 'active',
    isPremium: false,
    isTrialActive: false,
    trialEndsAt: null,
    usage: createEmptyUsage(),
  }
}
