import { getAppUrl } from '@/lib/env'

export const EMAIL_NOT_VERIFIED_CODE = 'email_not_verified'

const allowedCallbackPaths = new Set([
  '/verify-email',
  '/dashboard',
  '/sign-in',
])

export function getEmailVerificationCallbackPath(status = 'success') {
  return `/verify-email?status=${encodeURIComponent(status)}`
}

export function isSafeVerificationCallbackPath(value: string | null) {
  if (!value) return false

  try {
    const parsed = new URL(value, getAppUrl())
    const app = new URL(getAppUrl())
    if (parsed.origin !== app.origin) return false
    return allowedCallbackPaths.has(parsed.pathname)
  } catch {
    return false
  }
}

export function normalizeVerificationCallbackPath(value: string | null) {
  if (!isSafeVerificationCallbackPath(value)) {
    return getEmailVerificationCallbackPath()
  }

  const parsed = new URL(value!, getAppUrl())
  return `${parsed.pathname}${parsed.search}`
}

export function sanitizeBetterAuthVerificationUrl(value: string) {
  const configuredAppUrl = new URL(getAppUrl())
  const source = new URL(value, configuredAppUrl)
  const token = source.searchParams.get('token')
  if (!token) {
    throw new Error('verification_token_missing')
  }

  const callbackURL = normalizeVerificationCallbackPath(
    source.searchParams.get('callbackURL'),
  )
  const safe = new URL(source.pathname, configuredAppUrl)
  safe.searchParams.set('token', token)
  safe.searchParams.set('callbackURL', callbackURL)

  return safe.toString()
}

export function createEmailNotVerifiedPayload() {
  return {
    error: EMAIL_NOT_VERIFIED_CODE,
    code: EMAIL_NOT_VERIFIED_CODE,
    message: 'Email verification is required for this action.',
  }
}
