import { z } from 'zod'

export type PaddleEnvironment = 'sandbox'
export type PaddleBillingInterval = 'monthly' | 'annual'

export class PaddleConfigError extends Error {
  constructor(public code: 'paddle_not_configured' | 'paddle_invalid_config') {
    super(code)
  }
}

const environmentSchema = z.enum(['sandbox']).default('sandbox')

function optionalUrl(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).replace(/\/$/, '')
}

function timeoutMs(value: string | undefined) {
  const parsed = Number(value ?? 10000)
  if (!Number.isFinite(parsed)) return 10000
  return Math.min(Math.max(parsed, 3000), 30000)
}

export function getPaddleEnvironment(): PaddleEnvironment {
  return environmentSchema.parse(process.env.PADDLE_ENVIRONMENT || 'sandbox')
}

export function getPaddleApiBaseUrl() {
  if (process.env.PADDLE_API_BASE_URL) {
    return optionalUrl(process.env.PADDLE_API_BASE_URL, '')
  }
  return 'https://sandbox-api.paddle.com'
}

export function getPaddleClientSideEnvironment() {
  return 'sandbox'
}

export function getPaddlePublicConfig() {
  const environment = getPaddleEnvironment()
  return {
    environment,
    clientEnvironment: getPaddleClientSideEnvironment(),
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '',
  }
}

export function getPaddleServerConfig() {
  const environment = getPaddleEnvironment()
  const apiKey = process.env.PADDLE_API_KEY?.trim()
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET?.trim()
  const monthlyPriceId = process.env.PADDLE_PRO_MONTHLY_PRICE_ID?.trim()
  const annualPriceId = process.env.PADDLE_PRO_ANNUAL_PRICE_ID?.trim()

  if (!apiKey || !monthlyPriceId || !annualPriceId) {
    throw new PaddleConfigError('paddle_not_configured')
  }

  return {
    environment,
    apiKey,
    webhookSecret: webhookSecret ?? '',
    monthlyPriceId,
    annualPriceId,
    apiBaseUrl: getPaddleApiBaseUrl(),
    requestTimeoutMs: timeoutMs(process.env.PADDLE_REQUEST_TIMEOUT_MS),
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      process.env.BETTER_AUTH_URL?.replace(/\/$/, '') ||
      'http://localhost:3000',
  }
}

export function getPaddleWebhookConfig() {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim()
  if (!secret) throw new PaddleConfigError('paddle_not_configured')
  return {
    environment: getPaddleEnvironment(),
    webhookSecret: secret,
  }
}

export function getTrustedPaddlePriceId(interval: PaddleBillingInterval) {
  const config = getPaddleServerConfig()
  return interval === 'annual' ? config.annualPriceId : config.monthlyPriceId
}

export function getIntervalForPaddlePriceId(
  priceId: string | null | undefined,
) {
  if (!priceId) return null
  const monthly = process.env.PADDLE_PRO_MONTHLY_PRICE_ID?.trim()
  const annual = process.env.PADDLE_PRO_ANNUAL_PRICE_ID?.trim()
  if (priceId === monthly) return 'monthly' as const
  if (priceId === annual) return 'annual' as const
  return null
}

export function getPaddleDiagnostics() {
  const environment = getPaddleEnvironment()
  return {
    environment,
    apiBaseUrlHost: new URL(getPaddleApiBaseUrl()).host,
    hasApiKey: Boolean(process.env.PADDLE_API_KEY),
    hasClientToken: Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN),
    hasWebhookSecret: Boolean(process.env.PADDLE_WEBHOOK_SECRET),
    hasMonthlyPriceId: Boolean(process.env.PADDLE_PRO_MONTHLY_PRICE_ID),
    hasAnnualPriceId: Boolean(process.env.PADDLE_PRO_ANNUAL_PRICE_ID),
  }
}
