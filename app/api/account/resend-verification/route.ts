import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  AccountEmailProviderError,
  getAccountEmailProviderDiagnostics,
} from '@/lib/account/email-provider'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { getEmailVerificationCallbackPath } from '@/lib/email-verification-links'
import { checkRateLimit } from '@/lib/security/rate-limit'

type ResendStage =
  | 'REQUEST_STARTED'
  | 'AUTHENTICATED'
  | 'RATE_LIMIT_PASSED'
  | 'BETTER_AUTH_SEND_STARTED'
  | 'SUCCESS'

function logResendStage(stage: string, details: Record<string, unknown> = {}) {
  console.info(`[email-verification] ${stage}`, details)
}

function getErrorDetails(error: unknown) {
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

function getFailureCode(error: unknown) {
  if (error instanceof AccountEmailProviderError) return error.code
  return 'email_delivery_failed'
}

function getFailureStatus(error: unknown) {
  if (!(error instanceof AccountEmailProviderError)) return 502

  switch (error.code) {
    case 'email_provider_not_configured':
      return 500
    case 'email_provider_unauthorized':
    case 'email_sender_not_verified':
      return 502
    case 'email_provider_rejected':
      return 422
    case 'email_provider_rate_limited':
      return 429
    case 'email_provider_timeout':
      return 504
    case 'email_delivery_failed':
      return 502
  }
}

function getFailureMessage(code: string) {
  switch (code) {
    case 'email_provider_not_configured':
      return 'Email provider is not configured.'
    case 'email_provider_unauthorized':
      return 'Email provider credentials were rejected.'
    case 'email_sender_not_verified':
      return 'Email sender domain or address is not verified.'
    case 'email_provider_rejected':
      return 'Email provider rejected the request.'
    case 'email_provider_rate_limited':
      return 'Email provider rate limit was reached.'
    case 'email_provider_timeout':
      return 'Email provider request timed out.'
    default:
      return 'Email delivery failed.'
  }
}

function logResendFailure(input: {
  stage: string
  error: unknown
  durationMs: number
}) {
  const providerDiagnostics = getAccountEmailProviderDiagnostics()
  const errorDetails = getErrorDetails(input.error)
  const providerError =
    input.error instanceof AccountEmailProviderError ? input.error : null

  console.error('[email-verification] resend failed', {
    stage: input.stage,
    ...errorDetails,
    provider:
      providerError?.diagnostics.provider ?? providerDiagnostics.provider,
    providerHttpStatus: providerError?.diagnostics.httpStatus ?? null,
    providerErrorCode: providerError?.diagnostics.providerErrorCode ?? null,
    senderDomain:
      providerError?.diagnostics.senderDomain ??
      providerDiagnostics.senderDomain,
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

function rateLimitResponse(resetAt: Date) {
  const retryAfter = getRetryAfterSeconds(resetAt)
  return NextResponse.json(
    {
      ok: false,
      code: 'verification_resend_rate_limited',
      error: 'verification_resend_rate_limited',
      retryAfter,
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  )
}

export async function POST() {
  let stage: ResendStage = 'REQUEST_STARTED'
  const startedAt = performance.now()

  try {
    logResendStage(stage)
    const headerStore = await headers()
    const session = await auth.api.getSession({ headers: headerStore })
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    stage = 'AUTHENTICATED'
    logResendStage(stage, { userId: session.user.id })

    const [currentUser] = await db
      .select({ emailVerified: user.emailVerified, email: user.email })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (!currentUser) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (currentUser.emailVerified) {
      stage = 'SUCCESS'
      logResendStage(stage, { status: 'already_verified' })
      return NextResponse.json({ ok: true, status: 'already_verified' })
    }

    const ip = getClientIp(headerStore)
    const cooldownMs =
      Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS ?? 60) *
      1000
    const limits = [
      checkRateLimit({
        key: `email-verification:user:${session.user.id}`,
        limit: 3,
        windowMs: 10 * 60_000,
      }),
      checkRateLimit({
        key: `email-verification:email:${currentUser.email.toLowerCase()}`,
        limit: 3,
        windowMs: 10 * 60_000,
      }),
      checkRateLimit({
        key: `email-verification:ip:${ip}`,
        limit: 10,
        windowMs: 10 * 60_000,
      }),
      checkRateLimit({
        key: `email-verification:cooldown:${session.user.id}`,
        limit: 1,
        windowMs: Number.isFinite(cooldownMs) ? cooldownMs : 60_000,
      }),
    ]

    const blocked = limits.find((limit) => !limit.allowed)
    if (blocked) {
      return rateLimitResponse(blocked.resetAt)
    }

    stage = 'RATE_LIMIT_PASSED'
    logResendStage(stage, getAccountEmailProviderDiagnostics())

    stage = 'BETTER_AUTH_SEND_STARTED'
    logResendStage(stage)
    await auth.api.sendVerificationEmail({
      body: {
        email: currentUser.email,
        callbackURL: getEmailVerificationCallbackPath(),
      },
      headers: headerStore,
    })

    stage = 'SUCCESS'
    logResendStage(stage, {
      durationMs: Math.round(performance.now() - startedAt),
    })
    return NextResponse.json({ ok: true, status: 'sent' })
  } catch (error) {
    const code = getFailureCode(error)
    logResendFailure({
      stage,
      error,
      durationMs: Math.round(performance.now() - startedAt),
    })
    return NextResponse.json(
      {
        ok: false,
        code,
        error: code,
        stage,
        message: getFailureMessage(code),
      },
      { status: getFailureStatus(error) },
    )
  }
}
