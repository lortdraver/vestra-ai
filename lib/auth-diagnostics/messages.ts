import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  canonicalizeAuthErrorCode,
  extractAuthErrorDetails,
} from '@/lib/auth-diagnostics/shared'

export function getLocalizedAuthErrorMessage(
  dictionary: Dictionary,
  authError: unknown,
) {
  switch (canonicalizeAuthErrorCode(authError)) {
    case 'INVALID_ORIGIN':
    case 'MISSING_OR_NULL_ORIGIN':
      return dictionary.auth.genericError
    case 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED':
      return dictionary.auth.genericError
    case 'INVALID_EMAIL_OR_PASSWORD':
      return dictionary.auth.wrongPassword
    case 'EMAIL_NOT_VERIFIED':
      return dictionary.auth.emailNotVerified
    case 'USER_NOT_FOUND':
      return dictionary.auth.accountNotFound
  }

  const details = extractAuthErrorDetails(authError)
  const value = `${details.code ?? ''} ${details.message ?? ''}`
  const normalized = value.toLowerCase()

  if (normalized.includes('email') && normalized.includes('invalid')) {
    return dictionary.auth.invalidEmail
  }
  if (normalized.includes('exists') || normalized.includes('already')) {
    return dictionary.auth.accountAlreadyExists
  }
  if (normalized.includes('rate') || normalized.includes('too many')) {
    return dictionary.auth.tooManyAttempts
  }
  if (
    normalized.includes('email_not_verified') ||
    normalized.includes('not verified') ||
    normalized.includes('verify your email')
  ) {
    return dictionary.auth.emailNotVerified
  }

  return dictionary.auth.genericError
}
