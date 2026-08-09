import { getAppUrl } from '@/lib/env'

export const passwordResetConfig = {
  minPasswordLength: 8,
  maxPasswordLength: 128,
  tokenExpiresInSeconds: 60 * 60,
} as const

export type PasswordResetCode =
  | 'password_reset_rate_limited'
  | 'password_reset_email_delivery_failed'
  | 'password_reset_invalid_token'
  | 'password_reset_expired_token'
  | 'password_reset_token_used'
  | 'password_reset_invalid_password'
  | 'password_reset_failed'

export function getPasswordResetPublicSuccessPayload() {
  return {
    ok: true,
    status: 'sent',
  }
}

export function getPasswordResetCallbackPath() {
  return '/reset-password'
}

export function getCanonicalPasswordResetOrigin() {
  if (process.env.NODE_ENV === 'production') {
    return 'https://vestraapp.uk'
  }

  return new URL(getAppUrl()).origin
}

export function buildPasswordResetUrl(token: string) {
  const url = new URL('/reset-password', getCanonicalPasswordResetOrigin())
  url.searchParams.set('token', token)
  return url.toString()
}

export function getSanitizedUrlPath(value: string) {
  const url = new URL(value)
  return url.pathname
}

export function isPotentialPasswordResetToken(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value.trim())
  )
}

export function validatePasswordResetPassword(value: string) {
  if (
    value.length < passwordResetConfig.minPasswordLength ||
    value.length > passwordResetConfig.maxPasswordLength
  ) {
    return false
  }

  return true
}

export function createPasswordResetErrorPayload(input: {
  code: PasswordResetCode
  stage: string
  message: string
}) {
  return {
    ok: false,
    error: input.code,
    code: input.code,
    stage: input.stage,
    message: input.message,
  }
}
