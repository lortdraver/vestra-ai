import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPaddleCheckoutSession,
  getIntervalForPaddlePriceId,
  getPaddleApiBaseUrl,
  getPaddlePublicConfig,
  getPaddleServerConfig,
  PaddleConfigError,
  verifyPaddleSignature,
} from '@/lib/billing'

afterEach(() => {
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
