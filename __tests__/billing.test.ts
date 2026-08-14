import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPaddleCheckoutSession,
  getIntervalForPaddlePriceId,
  getPaddleApiBaseUrl,
  getPaddlePublicConfig,
  getPaddleServerConfig,
  PaddleConfigError,
  cancelPaddleSubscription,
  resumePaddleScheduledCancellation,
  switchPaddleSubscriptionPlan,
  verifyPaddleSignature,
} from '@/lib/billing'
import { evaluateSubscriptionLifecycle } from '@/lib/subscription/lifecycle'

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

function sign(rawBody: string, secret: string, timestamp = '123') {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}:${rawBody}`)
    .digest('hex')
  return `ts=${timestamp};h1=${signature}`
}

describe('Paddle config', () => {
  it('defaults to sandbox API host', () => {
    vi.stubEnv('PADDLE_ENVIRONMENT', 'sandbox')

    expect(getPaddleApiBaseUrl()).toBe('https://sandbox-api.paddle.com')
  })

  it('rejects live mode during sandbox-only monetization v1', () => {
    vi.stubEnv('PADDLE_ENVIRONMENT', 'live')

    expect(() => getPaddlePublicConfig()).toThrow()
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
      metadata: {},
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
