import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { getEmailVerificationCallbackPath } from '@/lib/email-verification-links'
import { checkRateLimit } from '@/lib/security/rate-limit'

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
  const headerStore = await headers()
  const session = await auth.api.getSession({ headers: headerStore })
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [currentUser] = await db
    .select({ emailVerified: user.emailVerified, email: user.email })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (currentUser.emailVerified) {
    return NextResponse.json({ ok: true, status: 'already_verified' })
  }

  const ip = getClientIp(headerStore)
  const cooldownMs =
    Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS ?? 60) * 1000
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

  try {
    await auth.api.sendVerificationEmail({
      body: {
        email: currentUser.email,
        callbackURL: getEmailVerificationCallbackPath(),
      },
      headers: headerStore,
    })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[email-verification] resend failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      })
    }

    return NextResponse.json(
      {
        ok: false,
        code: 'verification_resend_failed',
        error: 'verification_resend_failed',
      },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, status: 'sent' })
}
