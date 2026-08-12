export type CanonicalAuthErrorCode =
  | 'INVALID_ORIGIN'
  | 'MISSING_OR_NULL_ORIGIN'
  | 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED'
  | 'INVALID_EMAIL_OR_PASSWORD'
  | 'EMAIL_NOT_VERIFIED'
  | 'USER_NOT_FOUND'
  | 'GENERIC_AUTH_ERROR'

type ErrorLocation = 'top-level' | 'nested' | 'unknown'

type AuthErrorRecord = Record<string, unknown>

function isRecord(value: unknown): value is AuthErrorRecord {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function sanitizeDiagnosticMessage(value: unknown) {
  const message = readString(value)
  if (!message) return null
  return message.replace(/\s+/g, ' ').trim().slice(0, 200)
}

function getNestedError(record: AuthErrorRecord) {
  return isRecord(record.error) ? record.error : null
}

export function extractAuthErrorDetails(error: unknown) {
  if (!isRecord(error)) {
    return {
      status: null,
      code: null,
      message: sanitizeDiagnosticMessage(error),
      statusText: null,
      location: 'unknown' as ErrorLocation,
      isTopLevelError: false,
      isNestedBetterFetchError: false,
    }
  }

  const nested = getNestedError(error)
  const topLevelCode = readString(error.code)
  const nestedCode = nested ? readString(nested.code) : null
  const topLevelMessage = sanitizeDiagnosticMessage(error.message)
  const nestedMessage = nested
    ? sanitizeDiagnosticMessage(nested.message)
    : null
  const status =
    readNumber(error.status) ?? (nested ? readNumber(nested.status) : null)
  const statusText = readString(error.statusText)
  const location: ErrorLocation =
    topLevelCode || topLevelMessage
      ? 'top-level'
      : nestedCode || nestedMessage
        ? 'nested'
        : 'unknown'

  return {
    status,
    code: topLevelCode ?? nestedCode,
    message: topLevelMessage ?? nestedMessage,
    statusText,
    location,
    isTopLevelError: location === 'top-level',
    isNestedBetterFetchError: location === 'nested',
  }
}

export function canonicalizeAuthErrorCode(
  error: unknown,
): CanonicalAuthErrorCode {
  const details = extractAuthErrorDetails(error)
  const code = details.code?.toUpperCase()
  const normalizedMessage = details.message?.toLowerCase() ?? ''

  switch (code) {
    case 'INVALID_ORIGIN':
      return 'INVALID_ORIGIN'
    case 'MISSING_OR_NULL_ORIGIN':
      return 'MISSING_OR_NULL_ORIGIN'
    case 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED':
      return 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED'
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
      return 'INVALID_EMAIL_OR_PASSWORD'
    case 'EMAIL_NOT_VERIFIED':
      return 'EMAIL_NOT_VERIFIED'
    case 'USER_NOT_FOUND':
      return 'USER_NOT_FOUND'
  }

  if (normalizedMessage.includes('invalid origin')) {
    return 'INVALID_ORIGIN'
  }
  if (
    normalizedMessage.includes('missing') &&
    normalizedMessage.includes('origin')
  ) {
    return 'MISSING_OR_NULL_ORIGIN'
  }
  if (
    normalizedMessage.includes('cross-site') &&
    normalizedMessage.includes('blocked')
  ) {
    return 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED'
  }
  if (
    normalizedMessage.includes('invalid email or password') ||
    normalizedMessage.includes('invalid password')
  ) {
    return 'INVALID_EMAIL_OR_PASSWORD'
  }
  if (normalizedMessage.includes('email not verified')) {
    return 'EMAIL_NOT_VERIFIED'
  }
  if (normalizedMessage.includes('user not found')) {
    return 'USER_NOT_FOUND'
  }

  return 'GENERIC_AUTH_ERROR'
}
