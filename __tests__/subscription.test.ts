import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPaymentProvider } from '@/lib/payments'
import {
  checkUsage,
  createTrialWindow,
  getSubscriptionPlan,
  getSubscriptionUsageMeters,
  hasFeature,
  isPremiumPlan,
  isTrialActive,
  subscriptionUsagePeriods,
} from '@/lib/subscription/plans'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('subscription plans and feature flags', () => {
  it('defaults unknown plans to Free', () => {
    expect(getSubscriptionPlan(undefined).key).toBe('free')
    expect(getSubscriptionPlan('unknown').key).toBe('free')
  })

  it('matches the Paddle Sandbox EUR catalog currency', () => {
    const premium = getSubscriptionPlan('premium')

    expect(premium.priceMonthlyCents).toBe(499)
    expect(premium.currency).toBe('EUR')
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
          wardrobe_items: 30,
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

  it('allows high fair-use Premium usage below the ceiling', () => {
    const result = checkUsage(
      {
        plan: getSubscriptionPlan('premium'),
        usage: {
          wardrobe_items: 250,
          ai_analyses_monthly: 500,
          stylist_requests_monthly: 100,
          background_removals_monthly: 500,
          saved_outfits: 500,
        },
      },
      'stylist_requests_monthly',
    )

    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(250)
    expect(result.remaining).toBe(150)
  })

  it('describes authoritative counter periods consistently for the UI', () => {
    const resetAt = new Date('2026-08-01T00:00:00.000Z')
    const meters = getSubscriptionUsageMeters(
      {
        plan: getSubscriptionPlan('free'),
        usage: {
          wardrobe_items: 3,
          ai_analyses_monthly: 4,
          stylist_requests_monthly: 2,
          background_removals_monthly: 1,
          saved_outfits: 5,
        },
      },
      resetAt,
    )

    expect(subscriptionUsagePeriods.wardrobe_items).toBe('current')
    expect(subscriptionUsagePeriods.stylist_requests_monthly).toBe('month')
    expect(
      meters.find((meter) => meter.feature === 'stylist_requests_monthly'),
    ).toMatchObject({
      period: 'month',
      resetAt,
      used: 2,
    })
    expect(
      meters.find((meter) => meter.feature === 'wardrobe_items'),
    ).toMatchObject({
      period: 'current',
      resetAt: null,
      used: 3,
    })
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
      getPaymentProvider('paddle').createCheckout({
        userId: 'user_1',
        planKey: 'premium',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).resolves.toMatchObject({
      provider: 'paddle',
      status: 'not_configured',
      checkoutUrl: null,
    })

    vi.stubEnv('PADDLE_API_KEY', 'pdl_test_key')
    vi.stubEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'test_client_token')
    vi.stubEnv('PADDLE_PRO_MONTHLY_PRICE_ID', 'pri_monthly')
    vi.stubEnv('PADDLE_PRO_ANNUAL_PRICE_ID', 'pri_annual')

    await expect(
      getPaymentProvider('paddle').createCheckout({
        userId: 'user_1',
        planKey: 'premium',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).resolves.toMatchObject({
      provider: 'paddle',
      status: 'configured',
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
