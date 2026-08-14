import type { SubscriptionSnapshot } from '@/lib/subscription/types'

export const subscriptionDashboardRoute = '/dashboard/subscription'

export const subscriptionPageStates = [
  'free',
  'active_pro',
  'canceling',
  'past_due',
  'paused',
  'canceled',
] as const

export type SubscriptionPageState = (typeof subscriptionPageStates)[number]

export function getSubscriptionPageState(
  subscription: SubscriptionSnapshot,
): SubscriptionPageState {
  if (subscription.paymentIssue || subscription.status === 'past_due') {
    return 'past_due'
  }

  if (subscription.status === 'paused') {
    return 'paused'
  }

  if (subscription.cancelAtPeriodEnd && subscription.isPremium) {
    return 'canceling'
  }

  if (
    subscription.status === 'canceled' ||
    subscription.entitlementReason === 'canceled'
  ) {
    return 'canceled'
  }

  return subscription.isPremium ? 'active_pro' : 'free'
}

export function getSubscriptionSwitchTarget(
  subscription: SubscriptionSnapshot,
): 'monthly' | 'annual' | null {
  if (!subscription.isPremium || subscription.cancelAtPeriodEnd) {
    return null
  }

  if (subscription.billingInterval === 'monthly') {
    return 'annual'
  }

  if (subscription.billingInterval === 'annual') {
    return 'monthly'
  }

  return null
}
