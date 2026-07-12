import { describe, expect, it } from 'vitest'
import { getPaymentProvider } from '@/lib/payments'
import {
  checkUsage,
  createTrialWindow,
  getSubscriptionPlan,
  hasFeature,
  isPremiumPlan,
  isTrialActive,
} from '@/lib/subscription'

describe('subscription plans and feature flags', () => {
  it('defaults unknown plans to Free', () => {
    expect(getSubscriptionPlan(undefined).key).toBe('free')
    expect(getSubscriptionPlan('unknown').key).toBe('free')
  })

  it('identifies Premium plans and features', () => {
    const premium = getSubscriptionPlan('premium')

    expect(isPremiumPlan('premium')).toBe(true)
    expect(hasFeature(premium, 'wardrobe_insights')).toBe(true)
    expect(hasFeature(getSubscriptionPlan('free'), 'wardrobe_insights')).toBe(
      false,
    )
  })
})

describe('subscription usage limits', () => {
  it('blocks limited Free usage at the limit', () => {
    const result = checkUsage(
      {
        plan: getSubscriptionPlan('free'),
        usage: {
          wardrobe_items: 50,
          ai_analyses_monthly: 0,
          stylist_requests_monthly: 0,
          background_removals_monthly: 0,
          saved_outfits: 0,
        },
      },
      'wardrobe_items',
    )

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('allows unlimited Premium usage', () => {
    const result = checkUsage(
      {
        plan: getSubscriptionPlan('premium'),
        usage: {
          wardrobe_items: 5_000,
          ai_analyses_monthly: 500,
          stylist_requests_monthly: 500,
          background_removals_monthly: 500,
          saved_outfits: 500,
        },
      },
      'stylist_requests_monthly',
    )

    expect(result.allowed).toBe(true)
    expect(result.limit).toBeNull()
    expect(result.remaining).toBeNull()
  })
})

describe('trial support', () => {
  it('creates a seven-day Premium trial window', () => {
    const start = new Date('2026-07-06T00:00:00.000Z')
    const trial = createTrialWindow(start)

    expect(trial.trialEndsAt.toISOString()).toBe('2026-07-13T00:00:00.000Z')
    expect(isTrialActive(trial.trialEndsAt, start)).toBe(true)
    expect(isTrialActive(trial.trialEndsAt, new Date('2026-07-14'))).toBe(false)
  })
})

describe('payment provider abstraction', () => {
  it('returns inert provider responses until real payments are connected', async () => {
    await expect(
      getPaymentProvider('stripe').createCheckout({
        userId: 'user_1',
        planKey: 'premium',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).resolves.toMatchObject({
      provider: 'stripe',
      status: 'not_configured',
      checkoutUrl: null,
    })

    await expect(
      getPaymentProvider('manual').createCheckout({
        userId: 'user_1',
        planKey: 'premium',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).resolves.toMatchObject({
      provider: 'manual',
      status: 'pending_manual_activation',
      checkoutUrl: null,
    })
  })
})
