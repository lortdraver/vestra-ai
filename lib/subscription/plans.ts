import type {
  SubscriptionFeatureKey,
  SubscriptionLimits,
  SubscriptionPlanDefinition,
  SubscriptionPlanKey,
  SubscriptionSnapshot,
  SubscriptionUsageKey,
  UsageCheck,
} from './types'

export const premiumTrialDays = 7

const freeLimits: SubscriptionLimits = {
  wardrobe_items: 50,
  ai_analyses_monthly: 20,
  stylist_requests_monthly: 10,
  background_removals_monthly: 20,
  saved_outfits: 10,
}

const premiumLimits: SubscriptionLimits = {
  wardrobe_items: null,
  ai_analyses_monthly: null,
  stylist_requests_monthly: null,
  background_removals_monthly: null,
  saved_outfits: null,
}

export const subscriptionPlans = {
  free: {
    key: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    currency: 'USD',
    trialDays: 0,
    features: ['wardrobe_core', 'basic_ai_analysis', 'basic_stylist'],
    limits: freeLimits,
  },
  premium: {
    key: 'premium',
    name: 'Premium',
    priceMonthlyCents: 999,
    currency: 'USD',
    trialDays: premiumTrialDays,
    features: [
      'wardrobe_core',
      'basic_ai_analysis',
      'advanced_ai_analysis',
      'basic_stylist',
      'unlimited_stylist',
      'wardrobe_insights',
      'premium_support',
      'virtual_try_on_ready',
    ],
    limits: premiumLimits,
  },
} satisfies Record<SubscriptionPlanKey, SubscriptionPlanDefinition>

export function getSubscriptionPlan(
  key: string | null | undefined,
): SubscriptionPlanDefinition {
  return key === 'premium' ? subscriptionPlans.premium : subscriptionPlans.free
}

export function isPremiumPlan(key: string | null | undefined) {
  return getSubscriptionPlan(key).key === 'premium'
}

export function hasFeature(
  plan: SubscriptionPlanDefinition,
  feature: SubscriptionFeatureKey,
) {
  return plan.features.includes(feature)
}

export function isTrialActive(
  trialEndsAt: Date | string | null | undefined,
  now = new Date(),
) {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt).getTime() > now.getTime()
}

export function checkUsage(
  snapshot: Pick<SubscriptionSnapshot, 'plan' | 'usage'>,
  feature: SubscriptionUsageKey,
): UsageCheck {
  const used = snapshot.usage[feature] ?? 0
  const limit = snapshot.plan.limits[feature]

  if (limit === null) {
    return { allowed: true, used, limit, remaining: null }
  }

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(limit - used, 0),
  }
}

export function createTrialWindow(start = new Date()) {
  const trialEndsAt = new Date(start)
  trialEndsAt.setDate(trialEndsAt.getDate() + premiumTrialDays)

  return {
    trialStartedAt: start,
    trialEndsAt,
  }
}
