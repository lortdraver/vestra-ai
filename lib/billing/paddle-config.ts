import { z } from 'zod'

export type PaddleEnvironment = 'sandbox' | 'live'
export type PaddleClientEnvironment = 'sandbox' | 'production'
export type PaddleBillingInterval = 'monthly' | 'annual'

export type PaddleConfigErrorCode =
  | 'paddle_not_configured'
  | 'paddle_invalid_config'
  | 'paddle_environment_invalid'
  | 'paddle_environment_mismatch'
  | 'paddle_live_not_configured'
  | 'paddle_price_environment_mismatch'

export class PaddleConfigError extends Error {
  constructor(public code: PaddleConfigErrorCode) {
    super(code)
  }
}

const environmentSchema = z.enum(['sandbox', 'live'])

const paddleApiBaseUrls = {
  sandbox: 'https://sandbox-api.paddle.com',
  live: 'https://api.paddle.com',
} satisfies Record<PaddleEnvironment, string>

function optionalUrl(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).replace(/\/$/, '')
}

function timeoutMs(value: string | undefined) {
  const parsed = Number(value ?? 10000)
  if (!Number.isFinite(parsed)) return 10000
  return Math.min(Math.max(parsed, 3000), 30000)
}

function detectValueEnvironment(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? ''
  if (!normalized) return null
  if (
    normalized.includes('sandbox') ||
    normalized.includes('sdbx') ||
    normalized.includes('test_') ||
    normalized.includes('_test') ||
    normalized.includes('client_test') ||
    normalized.includes('webhook_test') ||
    normalized.includes('pri_test')
  ) {
    return 'sandbox' as const
  }
  if (
    normalized.includes('live') ||
    normalized.includes('production') ||
    normalized.includes('prod_') ||
    normalized.includes('_prod')
  ) {
    return 'live' as const
  }
  return null
}

function assertValueMatchesEnvironment(
  value: string | null | undefined,
  environment: PaddleEnvironment,
  mismatchCode: PaddleConfigErrorCode = 'paddle_environment_mismatch',
) {
  const detected = detectValueEnvironment(value)
  if (detected && detected !== environment) {
    throw new PaddleConfigError(mismatchCode)
  }
}

export function getPaddleEnvironment(): PaddleEnvironment {
  const parsed = environmentSchema.safeParse(process.env.PADDLE_ENVIRONMENT)
  if (!parsed.success) throw new PaddleConfigError('paddle_environment_invalid')
  return parsed.data
}

export function getPaddleApiBaseUrl() {
  const environment = getPaddleEnvironment()
  const baseUrl = optionalUrl(
    process.env.PADDLE_API_BASE_URL,
    paddleApiBaseUrls[environment],
  )
  const host = new URL(baseUrl).host
  if (environment === 'sandbox' && host !== 'sandbox-api.paddle.com') {
    throw new PaddleConfigError('paddle_environment_mismatch')
  }
  if (environment === 'live' && host !== 'api.paddle.com') {
    throw new PaddleConfigError('paddle_environment_mismatch')
  }
  return baseUrl
}

export function getPaddleClientSideEnvironment(): PaddleClientEnvironment {
  return getPaddleEnvironment() === 'sandbox' ? 'sandbox' : 'production'
}

export function validatePaddleEnvironmentConfig(input: {
  environment: PaddleEnvironment
  apiKey?: string | null
  clientToken?: string | null
  webhookSecret?: string | null
  monthlyPriceId?: string | null
  annualPriceId?: string | null
}) {
  assertValueMatchesEnvironment(input.apiKey, input.environment)
  assertValueMatchesEnvironment(input.clientToken, input.environment)
  assertValueMatchesEnvironment(input.webhookSecret, input.environment)
  assertValueMatchesEnvironment(
    input.monthlyPriceId,
    input.environment,
    'paddle_price_environment_mismatch',
  )
  assertValueMatchesEnvironment(
    input.annualPriceId,
    input.environment,
    'paddle_price_environment_mismatch',
  )
}

export function getPaddlePublicConfig() {
  const environment = getPaddleEnvironment()
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() ?? ''
  validatePaddleEnvironmentConfig({
    environment,
    clientToken,
  })
  if (environment === 'live' && !clientToken) {
    throw new PaddleConfigError('paddle_live_not_configured')
  }

  return {
    environment,
    clientEnvironment: getPaddleClientSideEnvironment(),
    clientToken,
  }
}

export function getPaddleServerConfig() {
  const environment = getPaddleEnvironment()
  const apiKey = process.env.PADDLE_API_KEY?.trim()
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET?.trim()
  const monthlyPriceId = process.env.PADDLE_PRO_MONTHLY_PRICE_ID?.trim()
  const annualPriceId = process.env.PADDLE_PRO_ANNUAL_PRICE_ID?.trim()

  validatePaddleEnvironmentConfig({
    environment,
    apiKey,
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim(),
    webhookSecret,
    monthlyPriceId,
    annualPriceId,
  })

  if (!apiKey || !monthlyPriceId || !annualPriceId) {
    throw new PaddleConfigError(
      environment === 'live'
        ? 'paddle_live_not_configured'
        : 'paddle_not_configured',
    )
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
  const environment = getPaddleEnvironment()
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim()
  validatePaddleEnvironmentConfig({
    environment,
    webhookSecret: secret,
  })
  if (!secret) {
    throw new PaddleConfigError(
      environment === 'live'
        ? 'paddle_live_not_configured'
        : 'paddle_not_configured',
    )
  }
  return {
    environment,
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

export function getPaddleMetadataEnvironment(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const value = (metadata as Record<string, unknown>).paddleEnvironment
  return value === 'sandbox' || value === 'live' ? value : null
}

export function paddleMetadataMatchesConfiguredEnvironment(metadata: unknown) {
  const configured = getPaddleEnvironment()
  return getPaddleMetadataEnvironment(metadata) === configured
}

export function getPaddleDiagnostics() {
  const environmentResult = environmentSchema.safeParse(
    process.env.PADDLE_ENVIRONMENT,
  )
  const environment = environmentResult.success ? environmentResult.data : null
  let apiBaseUrlHost: string | null = null
  let configError: PaddleConfigErrorCode | null = null

  try {
    apiBaseUrlHost = new URL(getPaddleApiBaseUrl()).host
    if (environment) {
      validatePaddleEnvironmentConfig({
        environment,
        apiKey: process.env.PADDLE_API_KEY?.trim(),
        clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim(),
        webhookSecret: process.env.PADDLE_WEBHOOK_SECRET?.trim(),
        monthlyPriceId: process.env.PADDLE_PRO_MONTHLY_PRICE_ID?.trim(),
        annualPriceId: process.env.PADDLE_PRO_ANNUAL_PRICE_ID?.trim(),
      })
    }
  } catch (error) {
    configError =
      error instanceof PaddleConfigError ? error.code : 'paddle_invalid_config'
  }

  return {
    environment,
    environmentValid: environmentResult.success,
    configError,
    apiBaseUrlHost,
    hasApiKey: Boolean(process.env.PADDLE_API_KEY),
    hasClientToken: Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN),
    hasWebhookSecret: Boolean(process.env.PADDLE_WEBHOOK_SECRET),
    hasMonthlyPriceId: Boolean(process.env.PADDLE_PRO_MONTHLY_PRICE_ID),
    hasAnnualPriceId: Boolean(process.env.PADDLE_PRO_ANNUAL_PRICE_ID),
  }
}
