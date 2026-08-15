import type { subscription } from '@/lib/db/schema'
import { paddleMetadataMatchesConfiguredEnvironment } from '@/lib/billing/paddle-config'
import type { SubscriptionStatus } from './types'

export type SubscriptionLifecycleState = {
  status: SubscriptionStatus
  isPro: boolean
  paymentIssue: boolean
  graceUntil: Date | null
  accessUntil: Date | null
  entitlementReason:
    | 'active'
    | 'trialing'
    | 'past_due_grace'
    | 'canceling_until_period_end'
    | 'free'
    | 'paused'
    | 'canceled'
    | 'inactive'
}

export const canonicalSubscriptionStatuses = [
  'active',
  'trialing',
  'past_due',
  'paused',
  'canceled',
  'inactive',
] as const

export function toSubscriptionStatus(
  status: string | null | undefined,
): SubscriptionStatus {
  return canonicalSubscriptionStatuses.includes(
    status as (typeof canonicalSubscriptionStatuses)[number],
  )
    ? (status as SubscriptionStatus)
    : 'inactive'
}

export function getPastDueGraceDays() {
  const parsed = Number(process.env.PADDLE_PAST_DUE_GRACE_DAYS ?? 3)
  if (!Number.isFinite(parsed)) return 3
  return Math.min(Math.max(Math.floor(parsed), 0), 30)
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000)
}

function paddleRowMatchesRuntime(row: typeof subscription.$inferSelect) {
  if (row.providerKey !== 'paddle') return true
  try {
    return paddleMetadataMatchesConfiguredEnvironment(row.metadata)
  } catch {
    return false
  }
}

export function subscriptionRowMatchesRuntime(
  row: typeof subscription.$inferSelect,
) {
  if (!paddleRowMatchesRuntime(row)) return false

  return !(
    row.providerKey === 'paddle' &&
    row.planKey === 'premium' &&
    !row.providerSubscriptionId
  )
}

export function evaluateSubscriptionLifecycle(
  row: typeof subscription.$inferSelect | undefined | null,
  now = new Date(),
): SubscriptionLifecycleState {
  if (!row) {
    return {
      status: 'inactive',
      isPro: false,
      paymentIssue: false,
      graceUntil: null,
      accessUntil: null,
      entitlementReason: 'free',
    }
  }

  if (!subscriptionRowMatchesRuntime(row)) {
    return {
      status: 'inactive',
      isPro: false,
      paymentIssue: false,
      graceUntil: null,
      accessUntil: null,
      entitlementReason: 'inactive',
    }
  }

  const status = toSubscriptionStatus(row.status)
  if (status === 'active') {
    const accessUntil = row.cancelAtPeriodEnd
      ? row.currentPeriodEnd
      : (row.currentPeriodEnd ?? null)
    return {
      status,
      isPro:
        !row.cancelAtPeriodEnd ||
        !row.currentPeriodEnd ||
        row.currentPeriodEnd.getTime() > now.getTime(),
      paymentIssue: false,
      graceUntil: null,
      accessUntil,
      entitlementReason: row.cancelAtPeriodEnd
        ? 'canceling_until_period_end'
        : 'active',
    }
  }

  if (status === 'trialing') {
    return {
      status,
      isPro: true,
      paymentIssue: false,
      graceUntil: null,
      accessUntil: row.trialEndsAt ?? row.currentPeriodEnd ?? null,
      entitlementReason: 'trialing',
    }
  }

  if (status === 'past_due') {
    const graceUntil = addDays(
      row.lastProviderEventAt ?? row.updatedAt ?? now,
      getPastDueGraceDays(),
    )
    return {
      status,
      isPro: graceUntil.getTime() > now.getTime(),
      paymentIssue: true,
      graceUntil,
      accessUntil: graceUntil,
      entitlementReason:
        graceUntil.getTime() > now.getTime() ? 'past_due_grace' : 'free',
    }
  }

  if (
    status === 'canceled' &&
    row.cancelAtPeriodEnd &&
    row.currentPeriodEnd &&
    row.currentPeriodEnd.getTime() > now.getTime()
  ) {
    return {
      status,
      isPro: true,
      paymentIssue: false,
      graceUntil: null,
      accessUntil: row.currentPeriodEnd,
      entitlementReason: 'canceling_until_period_end',
    }
  }

  return {
    status,
    isPro: false,
    paymentIssue: false,
    graceUntil: null,
    accessUntil: null,
    entitlementReason:
      status === 'paused'
        ? 'paused'
        : status === 'canceled'
          ? 'canceled'
          : 'inactive',
  }
}
