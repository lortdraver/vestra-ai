import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPaddleCheckoutSession,
  getIntervalForPaddlePriceId,
  getPaddleApiBaseUrl,
  getPaddleDiagnostics,
  getPaddlePublicConfig,
  getPaddleServerConfig,
  getPaddleWebhookConfig,
  PaddleConfigError,
  cancelPaddleSubscription,
  resumePaddleScheduledCancellation,
  switchPaddleSubscriptionPlan,
  verifyPaddleSignature,
} from '@/lib/billing'
import { getBillingCopy } from '@/lib/billing/copy'
import { isSubscriptionLifecycleEvent } from '@/lib/billing/paddle-events'
import {
  getSubscriptionPageState,
  getSubscriptionSwitchTarget,
  subscriptionDashboardRoute,
} from '@/lib/billing/subscription-page-model'
import { evaluateSubscriptionLifecycle } from '@/lib/subscription/lifecycle'
import { subscriptionPlans } from '@/lib/subscription/plans'
import type { SubscriptionSnapshot } from '@/lib/subscription/types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function stubPaddleEnv() {
  vi.stubEnv('PADDLE_ENVIRONMENT', 'sandbox')
  vi.stubEnv('PADDLE_API_KEY', 'pdl_test_key')
  vi.stubEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'client_test_token')
  vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'webhook_secret')
  vi.stubEnv('PADDLE_PRO_MONTHLY_PRICE_ID', 'pri_monthly')
  vi.stubEnv('PADDLE_PRO_ANNUAL_PRICE_ID', 'pri_annual')
}

function stubPaddleLiveEnv() {
  vi.stubEnv('PADDLE_ENVIRONMENT', 'live')
  vi.stubEnv('PADDLE_API_KEY', 'pdl_live_key')
  vi.stubEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'client_live_token')
  vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'webhook_live_secret')
  vi.stubEnv('PADDLE_PRO_MONTHLY_PRICE_ID', 'pri_live_monthly')
  vi.stubEnv('PADDLE_PRO_ANNUAL_PRICE_ID', 'pri_live_annual')
}

function sign(rawBody: string, secret: string, timestamp = '123') {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}:${rawBody}`)
    .digest('hex')
  return `ts=${timestamp};h1=${signature}`
}

function subscriptionSnapshot(
  overrides: Partial<SubscriptionSnapshot> = {},
): SubscriptionSnapshot {
  return {
    plan: subscriptionPlans.free,
    status: 'active',
    isPremium: false,
    isTrialActive: false,
    trialEndsAt: null,
    billingInterval: null,
    currentPeriodEnd: null,
    accessUntil: null,
    graceUntil: null,
    paymentIssue: false,
    entitlementReason: 'free',
    cancelAtPeriodEnd: false,
    usage: {
      wardrobe_items: 0,
      ai_analyses_monthly: 0,
      stylist_requests_monthly: 0,
      background_removals_monthly: 0,
      saved_outfits: 0,
    },
    ...overrides,
  }
}

describe('Paddle config', () => {
  it('defaults to sandbox API host', () => {
    vi.stubEnv('PADDLE_ENVIRONMENT', 'sandbox')

    expect(getPaddleApiBaseUrl()).toBe('https://sandbox-api.paddle.com')
  })

  it('uses the live API host only for explicit live mode', () => {
    stubPaddleLiveEnv()

    expect(getPaddleApiBaseUrl()).toBe('https://api.paddle.com')
    expect(getPaddlePublicConfig()).toEqual({
      environment: 'live',
      clientEnvironment: 'production',
      clientToken: 'client_live_token',
    })
  })

  it('rejects invalid or missing environments', () => {
    expect(() => getPaddlePublicConfig()).toThrow(PaddleConfigError)
    vi.stubEnv('PADDLE_ENVIRONMENT', 'live')

    expect(() => getPaddlePublicConfig()).toThrow('paddle_live_not_configured')
  })

  it('keeps the client token in public config but not server secrets', () => {
    stubPaddleEnv()

    expect(getPaddlePublicConfig()).toEqual({
      environment: 'sandbox',
      clientEnvironment: 'sandbox',
      clientToken: 'client_test_token',
    })
  })

  it('requires server-side Paddle config for checkout', () => {
    expect(() => getPaddleServerConfig()).toThrow(PaddleConfigError)
  })

  it('rejects sandbox credentials in live mode', () => {
    stubPaddleLiveEnv()
    vi.stubEnv('PADDLE_API_KEY', 'pdl_test_key')

    expect(() => getPaddleServerConfig()).toThrow('paddle_environment_mismatch')
  })

  it('rejects price ids that visibly belong to another environment', () => {
    stubPaddleLiveEnv()
    vi.stubEnv('PADDLE_PRO_MONTHLY_PRICE_ID', 'pri_test_monthly')

    expect(() => getPaddleServerConfig()).toThrow(
      'paddle_price_environment_mismatch',
    )
  })

  it('isolates webhook secrets by configured environment', () => {
    stubPaddleLiveEnv()
    vi.stubEnv('PADDLE_WEBHOOK_SECRET', 'webhook_test_secret')

    expect(() => getPaddleWebhookConfig()).toThrow(
      'paddle_environment_mismatch',
    )
  })

  it('maps canonical intervals to trusted price ids', () => {
    stubPaddleEnv()

    const monthly = createPaddleCheckoutSession({
      userId: 'user_1',
      email: 'test@example.com',
      interval: 'monthly',
    })
    const annual = createPaddleCheckoutSession({
      userId: 'user_1',
      email: 'test@example.com',
      interval: 'annual',
    })

    expect(monthly.priceId).toBe('pri_monthly')
    expect(annual.priceId).toBe('pri_annual')
    expect(monthly.customData).toEqual({ vestraUserId: 'user_1' })
    expect(getIntervalForPaddlePriceId('pri_annual')).toBe('annual')
    expect(getIntervalForPaddlePriceId('client_supplied_bad_id')).toBeNull()
  })
})

describe('billing copy', () => {
  it('displays the Paddle Sandbox EUR catalog prices', () => {
    const copy = getBillingCopy('en')

    expect(copy.monthlyPrice).toBe('€4.99/month')
    expect(copy.annualPrice).toBe('€39.99/year')
  })
})

describe('Paddle webhook signatures', () => {
  it('verifies a valid raw-body Paddle signature', () => {
    const rawBody = JSON.stringify({ event_id: 'evt_1' })

    expect(
      verifyPaddleSignature({
        rawBody,
        signatureHeader: sign(rawBody, 'secret'),
        secret: 'secret',
      }),
    ).toBe(true)
  })

  it('rejects invalid signatures', () => {
    const rawBody = JSON.stringify({ event_id: 'evt_1' })

    expect(
      verifyPaddleSignature({
        rawBody,
        signatureHeader: 'ts=123;h1=bad',
        secret: 'secret',
      }),
    ).toBe(false)
  })
})

describe('subscription lifecycle policy', () => {
  function row(overrides: Record<string, unknown>) {
    vi.stubEnv('PADDLE_ENVIRONMENT', 'sandbox')
    return {
      id: 'sub',
      userId: 'user',
      planKey: 'premium',
      status: 'active',
      providerKey: 'paddle',
      providerCustomerId: 'ctm',
      providerSubscriptionId: 'sub_provider',
      providerPriceId: 'pri_monthly',
      billingInterval: 'monthly',
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: new Date('2026-08-20T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      scheduledChangeAction: null,
      scheduledChangeAt: null,
      canceledAt: null,
      lastProviderEventAt: new Date('2026-08-14T00:00:00.000Z'),
      metadata: { paddleEnvironment: 'sandbox' },
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-14T00:00:00.000Z'),
      ...overrides,
    } as never
  }

  it('keeps canceling subscriptions Pro until the current period ends', () => {
    const state = evaluateSubscriptionLifecycle(
      row({ cancelAtPeriodEnd: true }),
      new Date('2026-08-15T00:00:00.000Z'),
    )

    expect(state.isPro).toBe(true)
    expect(state.entitlementReason).toBe('canceling_until_period_end')
  })

  it('returns canceling subscriptions to Free after the period ends', () => {
    const state = evaluateSubscriptionLifecycle(
      row({
        status: 'canceled',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2026-08-10T00:00:00.000Z'),
      }),
      new Date('2026-08-15T00:00:00.000Z'),
    )

    expect(state.isPro).toBe(false)
    expect(state.entitlementReason).toBe('canceled')
  })

  it('grants past-due grace and then expires it dynamically', () => {
    vi.stubEnv('PADDLE_PAST_DUE_GRACE_DAYS', '3')

    const duringGrace = evaluateSubscriptionLifecycle(
      row({ status: 'past_due' }),
      new Date('2026-08-16T00:00:00.000Z'),
    )
    const afterGrace = evaluateSubscriptionLifecycle(
      row({ status: 'past_due' }),
      new Date('2026-08-20T00:00:00.000Z'),
    )

    expect(duringGrace.isPro).toBe(true)
    expect(duringGrace.paymentIssue).toBe(true)
    expect(afterGrace.isPro).toBe(false)
  })

  it('treats paused subscriptions as Free entitlement state', () => {
    const state = evaluateSubscriptionLifecycle(row({ status: 'paused' }))

    expect(state.isPro).toBe(false)
    expect(state.entitlementReason).toBe('paused')
  })

  it('does not grant Paddle Pro without a provider subscription id', () => {
    const state = evaluateSubscriptionLifecycle(
      row({
        status: 'past_due',
        providerSubscriptionId: null,
      }),
      new Date('2026-08-15T00:00:00.000Z'),
    )

    expect(state.isPro).toBe(false)
    expect(state.paymentIssue).toBe(false)
    expect(state.entitlementReason).toBe('inactive')
  })

  it('ignores sandbox Paddle subscriptions when runtime is configured for live', () => {
    const sandboxRow = row({ status: 'active' })
    vi.stubEnv('PADDLE_ENVIRONMENT', 'live')

    const state = evaluateSubscriptionLifecycle(
      sandboxRow,
      new Date('2026-08-15T00:00:00.000Z'),
    )

    expect(state.isPro).toBe(false)
    expect(state.entitlementReason).toBe('inactive')
  })
})

describe('Paddle webhook event policy', () => {
  it('only lets subscription lifecycle events update subscription snapshots', () => {
    expect(isSubscriptionLifecycleEvent('subscription.created')).toBe(true)
    expect(isSubscriptionLifecycleEvent('subscription.past_due')).toBe(true)
    expect(isSubscriptionLifecycleEvent('transaction.completed')).toBe(false)
    expect(isSubscriptionLifecycleEvent('transaction.payment_failed')).toBe(
      false,
    )
  })
})

describe('subscription page state model', () => {
  it('uses the dedicated authenticated subscription route', () => {
    expect(subscriptionDashboardRoute).toBe('/dashboard/subscription')
  })

  it('renders Free state for non-premium users', () => {
    expect(getSubscriptionPageState(subscriptionSnapshot())).toBe('free')
  })

  it('renders Active Pro state for monthly subscribers', () => {
    const snapshot = subscriptionSnapshot({
      plan: subscriptionPlans.premium,
      isPremium: true,
      billingInterval: 'monthly',
      entitlementReason: 'active',
    })

    expect(getSubscriptionPageState(snapshot)).toBe('active_pro')
    expect(getSubscriptionSwitchTarget(snapshot)).toBe('annual')
  })

  it('renders Active Pro state for annual subscribers', () => {
    const snapshot = subscriptionSnapshot({
      plan: subscriptionPlans.premium,
      isPremium: true,
      billingInterval: 'annual',
      entitlementReason: 'active',
    })

    expect(getSubscriptionPageState(snapshot)).toBe('active_pro')
    expect(getSubscriptionSwitchTarget(snapshot)).toBe('monthly')
  })

  it('renders Canceling state and disables plan switching', () => {
    const snapshot = subscriptionSnapshot({
      plan: subscriptionPlans.premium,
      isPremium: true,
      billingInterval: 'monthly',
      cancelAtPeriodEnd: true,
      entitlementReason: 'canceling_until_period_end',
    })

    expect(getSubscriptionPageState(snapshot)).toBe('canceling')
    expect(getSubscriptionSwitchTarget(snapshot)).toBeNull()
  })

  it('renders Past Due state when payment action is required', () => {
    expect(
      getSubscriptionPageState(
        subscriptionSnapshot({
          plan: subscriptionPlans.premium,
          status: 'past_due',
          isPremium: true,
          paymentIssue: true,
          entitlementReason: 'past_due_grace',
        }),
      ),
    ).toBe('past_due')
  })

  it('renders Paused state without granting Pro actions', () => {
    const snapshot = subscriptionSnapshot({
      plan: subscriptionPlans.premium,
      status: 'paused',
      entitlementReason: 'paused',
    })

    expect(getSubscriptionPageState(snapshot)).toBe('paused')
    expect(getSubscriptionSwitchTarget(snapshot)).toBeNull()
  })

  it('renders Canceled state for expired Pro subscriptions', () => {
    expect(
      getSubscriptionPageState(
        subscriptionSnapshot({
          plan: subscriptionPlans.premium,
          status: 'canceled',
          entitlementReason: 'canceled',
        }),
      ),
    ).toBe('canceled')
  })
})

describe('Paddle lifecycle API contracts', () => {
  it('cancels at the next billing period', async () => {
    stubPaddleEnv()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'sub_1' } }), {
        status: 200,
      }),
    )

    await cancelPaddleSubscription('sub_1')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sandbox-api.paddle.com/subscriptions/sub_1/cancel',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ effective_from: 'next_billing_period' }),
      }),
    )
  })

  it('removes scheduled cancellation through subscription update', async () => {
    stubPaddleEnv()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'sub_1' } }), {
        status: 200,
      }),
    )

    await resumePaddleScheduledCancellation('sub_1')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sandbox-api.paddle.com/subscriptions/sub_1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ scheduled_change: null }),
      }),
    )
  })

  it('switches billing interval with trusted price ids only', async () => {
    stubPaddleEnv()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'sub_1' } }), {
        status: 200,
      }),
    )

    await switchPaddleSubscriptionPlan({
      subscriptionId: 'sub_1',
      interval: 'annual',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sandbox-api.paddle.com/subscriptions/sub_1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          proration_billing_mode: 'prorated_immediately',
          items: [{ price_id: 'pri_annual', quantity: 1 }],
        }),
      }),
    )
  })
})

describe('Paddle live readiness source contracts', () => {
  it('keeps client Paddle initialization environment-aware', () => {
    const source = readFileSync(
      join(process.cwd(), 'components/billing/pricing-client.tsx'),
      'utf8',
    )

    expect(source).toContain(
      "Environment?: { set(value: 'sandbox' | 'production')",
    )
    expect(source).toContain(
      'window.Paddle.Environment?.set(response.environment)',
    )
    expect(source).toContain('window.__vestraPaddleToken')
  })

  it('adds a read-only live preflight command', () => {
    const packageJson = readFileSync(
      join(process.cwd(), 'package.json'),
      'utf8',
    )
    const script = readFileSync(
      join(process.cwd(), 'scripts/billing-live-preflight.mjs'),
      'utf8',
    )

    expect(packageJson).toContain('billing:live-preflight')
    expect(script).toContain('mutation: false')
    expect(script).toContain('paddle_webhook_route_exists')
    expect(script).not.toContain('client.query(')
  })

  it('diagnostics stay sanitized when environment configuration is invalid', () => {
    vi.stubEnv('PADDLE_ENVIRONMENT', 'production')

    expect(getPaddleDiagnostics()).toMatchObject({
      environment: null,
      environmentValid: false,
    })
  })
})
