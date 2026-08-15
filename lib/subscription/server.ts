import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscription, subscriptionUsage } from '@/lib/db/schema'
import { getSubscriptionPlan, isPremiumPlan, isTrialActive } from './plans'
import {
  evaluateSubscriptionLifecycle,
  subscriptionRowMatchesRuntime,
} from './lifecycle'
import type {
  SubscriptionEntitlementSource,
  SubscriptionSnapshot,
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

type SubscriptionRow = typeof subscription.$inferSelect

function isPaddleProRow(row: SubscriptionRow, now: Date) {
  if (row.providerKey !== 'paddle' || !isPremiumPlan(row.planKey)) {
    return false
  }

  return evaluateSubscriptionLifecycle(row, now).isPro
}

function isInternalOverrideRow(row: SubscriptionRow, now: Date) {
  if (
    row.providerKey !== 'internal_override' ||
    row.planKey !== 'premium' ||
    row.providerCustomerId ||
    row.providerSubscriptionId
  ) {
    return false
  }

  return evaluateSubscriptionLifecycle(row, now).isPro
}

function selectEntitlementRow(rows: SubscriptionRow[], now: Date) {
  const runtimeRows = rows.filter((row) => subscriptionRowMatchesRuntime(row))
  const paddleProRow = runtimeRows.find((row) => isPaddleProRow(row, now))
  if (paddleProRow) return paddleProRow

  const internalOverrideRow = runtimeRows.find((row) =>
    isInternalOverrideRow(row, now),
  )
  if (internalOverrideRow) return internalOverrideRow

  return runtimeRows[0] ?? null
}

function resolveEntitlementSource(
  row: SubscriptionRow | null,
  trialActive: boolean,
): SubscriptionEntitlementSource {
  if (row?.providerKey === 'paddle') return 'paddle'
  if (row?.providerKey === 'internal_override') return 'internal_override'
  if (trialActive) return 'trial'
  if (!row) return 'none'

  return 'free'
}

export async function getSubscriptionSnapshot(
  userId: string,
  now = new Date(),
): Promise<SubscriptionSnapshot> {
  const subscriptionRows = await db
    .select()
    .from(subscription)
    .where(eq(subscription.userId, userId))
    .orderBy(desc(subscription.updatedAt))
    .limit(10)
  const subscriptionRow = selectEntitlementRow(subscriptionRows, now)

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
  const lifecycle = evaluateSubscriptionLifecycle(subscriptionRow, now)

  return {
    plan,
    status: lifecycle.status,
    isPremium:
      (isPremiumPlan(subscriptionRow?.planKey) && lifecycle.isPro) ||
      trialActive,
    entitlementSource: resolveEntitlementSource(subscriptionRow, trialActive),
    isTrialActive: trialActive,
    trialEndsAt: subscriptionRow?.trialEndsAt ?? null,
    billingInterval:
      subscriptionRow?.billingInterval === 'monthly' ||
      subscriptionRow?.billingInterval === 'annual'
        ? subscriptionRow.billingInterval
        : null,
    currentPeriodEnd: subscriptionRow?.currentPeriodEnd ?? null,
    accessUntil: lifecycle.accessUntil,
    graceUntil: lifecycle.graceUntil,
    paymentIssue: lifecycle.paymentIssue,
    entitlementReason: lifecycle.entitlementReason,
    cancelAtPeriodEnd: subscriptionRow?.cancelAtPeriodEnd ?? false,
    usage,
  }
}

export function getFallbackSubscriptionSnapshot(): SubscriptionSnapshot {
  return {
    plan: getSubscriptionPlan('free'),
    status: 'active',
    isPremium: false,
    entitlementSource: 'free',
    isTrialActive: false,
    trialEndsAt: null,
    billingInterval: null,
    currentPeriodEnd: null,
    accessUntil: null,
    graceUntil: null,
    paymentIssue: false,
    entitlementReason: 'free',
    cancelAtPeriodEnd: false,
    usage: createEmptyUsage(),
  }
}
