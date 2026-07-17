import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
export {
  createEmailNotVerifiedPayload,
  EMAIL_NOT_VERIFIED_CODE,
  getEmailVerificationCallbackPath,
  isSafeVerificationCallbackPath,
  normalizeVerificationCallbackPath,
  sanitizeBetterAuthVerificationUrl,
} from '@/lib/email-verification-links'
import {
  createEmailNotVerifiedPayload,
  EMAIL_NOT_VERIFIED_CODE,
} from '@/lib/email-verification-links'

export type EmailVerificationGuardResult =
  | { ok: true; userId: string; email: string; emailVerified: true }
  | {
      ok: false
      status: 401 | 403
      code: 'unauthorized' | typeof EMAIL_NOT_VERIFIED_CODE
      response: NextResponse
    }

export async function requireVerifiedEmailSession(): Promise<EmailVerificationGuardResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id || !session.user.email) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }

  const [currentUser] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser?.emailVerified) {
    return {
      ok: false,
      status: 403,
      code: EMAIL_NOT_VERIFIED_CODE,
      response: NextResponse.json(createEmailNotVerifiedPayload(), {
        status: 403,
      }),
    }
  }

  return {
    ok: true,
    userId: session.user.id,
    email: session.user.email,
    emailVerified: true,
  }
}
