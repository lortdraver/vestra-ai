import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { verification } from '@/lib/db/schema'
import {
  createPasswordResetErrorPayload,
  isPotentialPasswordResetToken,
  validatePasswordResetPassword,
  type PasswordResetCode,
} from '@/lib/password-reset'

type PasswordResetStage = 'PASSWORD_RESET_STARTED' | 'PASSWORD_RESET_COMPLETED'

const resetSchema = z.object({
  token: z.string(),
  newPassword: z.string(),
})

function logStage(stage: string, details: Record<string, unknown> = {}) {
  console.info(`[password-reset] ${stage}`, details)
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

function getResetMessage(code: PasswordResetCode) {
  switch (code) {
    case 'password_reset_invalid_token':
      return 'Password reset token is invalid.'
    case 'password_reset_expired_token':
      return 'Password reset token has expired.'
    case 'password_reset_token_used':
      return 'Password reset token has already been used.'
    case 'password_reset_invalid_password':
      return 'Password does not meet the requirements.'
    default:
      return 'Password reset failed.'
  }
}

function getResetStatus(code: PasswordResetCode) {
  switch (code) {
    case 'password_reset_invalid_password':
      return 400
    case 'password_reset_invalid_token':
    case 'password_reset_expired_token':
    case 'password_reset_token_used':
      return 400
    default:
      return 502
  }
}

function errorResponse(code: PasswordResetCode, stage: PasswordResetStage) {
  return NextResponse.json(
    createPasswordResetErrorPayload({
      code,
      stage,
      message: getResetMessage(code),
    }),
    { status: getResetStatus(code) },
  )
}

function logFailure(input: {
  stage: string
  error: unknown
  durationMs: number
}) {
  console.error('[password-reset] reset failed', {
    stage: input.stage,
    ...getErrorDetail(input.error),
    durationMs: input.durationMs,
    requiredEnvPresent: {
      betterAuthUrl: Boolean(process.env.BETTER_AUTH_URL),
      nextPublicAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    },
  })
}

export async function POST(request: Request) {
  let stage: PasswordResetStage = 'PASSWORD_RESET_STARTED'
  const startedAt = performance.now()

  try {
    logStage(stage)
    const body = await request.json().catch(() => null)
    const parsed = resetSchema.safeParse(body)

    if (!parsed.success || !isPotentialPasswordResetToken(parsed.data.token)) {
      return errorResponse('password_reset_invalid_token', stage)
    }

    if (!validatePasswordResetPassword(parsed.data.newPassword)) {
      return errorResponse('password_reset_invalid_password', stage)
    }

    const identifier = `reset-password:${parsed.data.token}`
    const [row] = await db
      .select({
        expiresAt: verification.expiresAt,
      })
      .from(verification)
      .where(eq(verification.identifier, identifier))
      .limit(1)

    if (!row) {
      return errorResponse('password_reset_token_used', stage)
    }

    if (row.expiresAt < new Date()) {
      return errorResponse('password_reset_expired_token', stage)
    }

    await auth.api.resetPassword({
      body: {
        token: parsed.data.token,
        newPassword: parsed.data.newPassword,
      },
      headers: await headers(),
    })

    stage = 'PASSWORD_RESET_COMPLETED'
    logStage(stage, {
      durationMs: Math.round(performance.now() - startedAt),
    })

    return NextResponse.json({ ok: true, status: 'password_reset' })
  } catch (error) {
    logFailure({
      stage,
      error,
      durationMs: Math.round(performance.now() - startedAt),
    })

    return errorResponse('password_reset_failed', stage)
  }
}
