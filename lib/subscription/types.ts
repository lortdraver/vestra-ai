export const subscriptionPlanKeys = ['free', 'premium'] as const
export type SubscriptionPlanKey = (typeof subscriptionPlanKeys)[number]

export const subscriptionStatuses = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'expired',
] as const
export type SubscriptionStatus = (typeof subscriptionStatuses)[number]

export const subscriptionFeatureKeys = [
  'wardrobe_core',
  'basic_ai_analysis',
  'advanced_ai_analysis',
  'basic_stylist',
  'unlimited_stylist',
  'wardrobe_insights',
  'premium_support',
  'virtual_try_on_ready',
] as const
export type SubscriptionFeatureKey = (typeof subscriptionFeatureKeys)[number]

export const subscriptionUsageKeys = [
  'wardrobe_items',
  'ai_analyses_monthly',
  'stylist_requests_monthly',
  'background_removals_monthly',
  'saved_outfits',
] as const
export type SubscriptionUsageKey = (typeof subscriptionUsageKeys)[number]

export type SubscriptionLimits = Record<SubscriptionUsageKey, number | null>

export type SubscriptionPlanDefinition = {
  key: SubscriptionPlanKey
  name: string
  priceMonthlyCents: number
  currency: string
  trialDays: number
  features: SubscriptionFeatureKey[]
  limits: SubscriptionLimits
}

export type SubscriptionUsageSnapshot = Record<SubscriptionUsageKey, number>

export type SubscriptionSnapshot = {
  plan: SubscriptionPlanDefinition
  status: SubscriptionStatus
  isPremium: boolean
  isTrialActive: boolean
  trialEndsAt: Date | null
  usage: SubscriptionUsageSnapshot
}

export type UsageCheck = {
  allowed: boolean
  used: number
  limit: number | null
  remaining: number | null
}
