import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  AccountEmailProviderError,
  getAccountEmailProviderDiagnostics,
} from '@/lib/account/email-provider'
import { auth } from '@/lib/auth'
import {
  createPasswordResetErrorPayload,
  getPasswordResetCallbackPath,
  getPasswordResetPublicSuccessPayload,
  type PasswordResetCode,
} from '@/lib/password-reset'
import { checkRateLimit } from '@/lib/security/rate-limit'

type ResetRequestStage =
  | 'RESET_REQUEST_STARTED'
  | 'RESET_REQUEST_VALIDATED'
  | 'BETTER_AUTH_RESET_REQUEST_STARTED'
  | 'RESET_REQUEST_COMPLETED'

const requestSchema = z.object({
  email: z.string().email(),
})

function logStage(stage: string, details: Record<string, unknown> = {}) {
  console.info(`[password-reset] ${stage}`, details)
}

function getClientIp(headerStore: Headers) {
  return (
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    'unknown'
  )
}

function getRetryAfterSeconds(resetAt: Date) {
  return Math.max(Math.ceil((resetAt.getTime() - Date.now()) / 1000), 1)
}

function getErrorDetail(error: unknown) {
  return error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    : {
        name: 'UnknownError',
        message: String(error),
        stack: null,
      }
}

function mapResetRequestError(error: unknown): PasswordResetCode {
  if (error instanceof AccountEmailProviderError) {
    return 'password_reset_email_delivery_failed'
  }

  return 'password_reset_failed'
}

function getResetRequestMessage(code: PasswordResetCode) {
  switch (code) {
    case 'password_reset_rate_limited':
      return 'Too many password reset requests.'
    case 'password_reset_email_delivery_failed':
      return 'Unable to deliver the password reset email.'
    default:
      return 'Password reset request failed.'
  }
}

function getResetRequestStatus(code: PasswordResetCode) {
  switch (code) {
    case 'password_reset_rate_limited':
      return 429
    case 'password_reset_email_delivery_failed':
      return 502
    default:
      return 400
  }
}

function logFailure(input: {
  stage: string
  error: unknown
  durationMs: number
}) {
  const providerDiagnostics = getAccountEmailProviderDiagnostics()
  const providerError =
    input.error instanceof AccountEmailProviderError ? input.error : null

  console.error('[password-reset] request failed', {
    stage: input.stage,
    ...getErrorDetail(input.error),
    provider:
      providerError?.diagnostics.provider ?? providerDiagnostics.provider,
    providerHttpStatus: providerError?.diagnostics.httpStatus ?? null,
    providerErrorCode: providerError?.diagnostics.providerErrorCode ?? null,
    durationMs: providerError?.diagnostics.durationMs ?? input.durationMs,
    requiredEnvPresent: {
      emailProvider: Boolean(process.env.EMAIL_PROVIDER),
      emailFrom: Boolean(process.env.EMAIL_FROM),
      emailReplyTo: Boolean(process.env.EMAIL_REPLY_TO),
      resendApiKey: Boolean(process.env.RESEND_API_KEY),
      betterAuthUrl: Boolean(process.env.BETTER_AUTH_URL),
      nextPublicAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    },
  })
}

function rateLimitResponse(resetAt: Date, stage: string) {
  const retryAfter = getRetryAfterSeconds(resetAt)

  return NextResponse.json(
    {
      ...createPasswordResetErrorPayload({
        code: 'password_reset_rate_limited',
        stage,
        message: getResetRequestMessage('password_reset_rate_limited'),
      }),
      retryAfter,
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  )
}

export async function POST(request: Request) {
  let stage: ResetRequestStage = 'RESET_REQUEST_STARTED'
  const startedAt = performance.now()

  try {
    logStage(stage)
    const headerStore = await headers()
    const body = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      stage = 'RESET_REQUEST_VALIDATED'
      logStage(stage, { valid: false })
      return NextResponse.json(getPasswordResetPublicSuccessPayload())
    }

    const email = parsed.data.email.trim().toLowerCase()
    stage = 'RESET_REQUEST_VALIDATED'
    logStage(stage, { valid: true })

    const ip = getClientIp(headerStore)
    const limits = [
      checkRateLimit({
        key: `password-reset:email:${email}`,
        limit: 3,
        windowMs: 15 * 60_000,
      }),
      checkRateLimit({
        key: `password-reset:ip:${ip}`,
        limit: 10,
        windowMs: 15 * 60_000,
      }),
    ]
    const blocked = limits.find((limit) => !limit.allowed)
    if (blocked) {
      return rateLimitResponse(blocked.resetAt, stage)
    }

    logStage('RESET_REQUEST_VALIDATED', { rateLimit: 'passed' })
    logStage('EMAIL_PROVIDER_SELECTED', getAccountEmailProviderDiagnostics())

    stage = 'BETTER_AUTH_RESET_REQUEST_STARTED'
    logStage(stage)
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: getPasswordResetCallbackPath(),
      },
      headers: headerStore,
    })

    stage = 'RESET_REQUEST_COMPLETED'
    logStage(stage, {
      durationMs: Math.round(performance.now() - startedAt),
    })

    return NextResponse.json(getPasswordResetPublicSuccessPayload())
  } catch (error) {
    const code = mapResetRequestError(error)
    logFailure({
      stage,
      error,
      durationMs: Math.round(performance.now() - startedAt),
    })

    return NextResponse.json(
      createPasswordResetErrorPayload({
        code,
        stage,
        message: getResetRequestMessage(code),
      }),
      { status: getResetRequestStatus(code) },
    )
  }
}
