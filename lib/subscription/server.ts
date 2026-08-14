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
  return [
    'active',
    'trialing',
    'past_due',
    'paused',
    'canceled',
    'inactive',
    'expired',
  ].includes(status ?? '')
    ? (status as SubscriptionStatus)
    : 'active'
}

function isSubscriptionEntitled(
  row: typeof subscription.$inferSelect | undefined,
  now: Date,
) {
  if (!row) return false
  const status = toSubscriptionStatus(row.status)
  if (status === 'active' || status === 'trialing') return true
  if (status === 'past_due') return true
  if (
    status === 'canceled' &&
    row.cancelAtPeriodEnd &&
    row.currentPeriodEnd &&
    row.currentPeriodEnd.getTime() > now.getTime()
  ) {
    return true
  }
  return false
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
  const entitled = isSubscriptionEntitled(subscriptionRow, now)

  return {
    plan,
    status: toSubscriptionStatus(subscriptionRow?.status),
    isPremium:
      (isPremiumPlan(subscriptionRow?.planKey) && entitled) || trialActive,
    isTrialActive: trialActive,
    trialEndsAt: subscriptionRow?.trialEndsAt ?? null,
    billingInterval:
      subscriptionRow?.billingInterval === 'monthly' ||
      subscriptionRow?.billingInterval === 'annual'
        ? subscriptionRow.billingInterval
        : null,
    currentPeriodEnd: subscriptionRow?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscriptionRow?.cancelAtPeriodEnd ?? false,
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
    billingInterval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    usage: createEmptyUsage(),
  }
}
