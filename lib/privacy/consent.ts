export const consentCookieName = 'vestra_consent'
export const consentVersion = 1
export const consentPolicyVersion = '2026-08-12'
export const consentMaxAgeSeconds = 60 * 60 * 24 * 365

export type ConsentPreferences = {
  version: number
  necessary: true
  analytics: boolean
  timestamp: string
  policyVersion: string
}

export type ConsentDecision = 'accepted' | 'rejected' | 'custom'

export type ConsentState = {
  preferences: ConsentPreferences | null
  hasDecision: boolean
  hasAnalyticsConsent: boolean
  requiresRefresh: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function createConsentPreferences(
  analytics: boolean,
  now = new Date(),
): ConsentPreferences {
  return {
    version: consentVersion,
    necessary: true,
    analytics,
    timestamp: now.toISOString(),
    policyVersion: consentPolicyVersion,
  }
}

export function serializeConsent(preferences: ConsentPreferences): string {
  return encodeURIComponent(JSON.stringify(preferences))
}

export function parseConsentCookieValue(
  value: string | undefined | null,
): ConsentPreferences | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown
    if (!isRecord(parsed)) return null
    if (parsed.necessary !== true) return null
    if (typeof parsed.analytics !== 'boolean') return null
    if (typeof parsed.timestamp !== 'string') return null
    if (typeof parsed.policyVersion !== 'string') return null
    if (typeof parsed.version !== 'number') return null

    return {
      version: parsed.version,
      necessary: true,
      analytics: parsed.analytics,
      timestamp: parsed.timestamp,
      policyVersion: parsed.policyVersion,
    }
  } catch {
    return null
  }
}

export function getConsent(
  cookieValue: string | undefined | null,
): ConsentState {
  const preferences = parseConsentCookieValue(cookieValue)
  const requiresRefresh = Boolean(
    preferences &&
    (preferences.version !== consentVersion ||
      preferences.policyVersion !== consentPolicyVersion),
  )

  return {
    preferences,
    hasDecision: Boolean(preferences) && !requiresRefresh,
    hasAnalyticsConsent: Boolean(preferences?.analytics) && !requiresRefresh,
    requiresRefresh,
  }
}

export function hasAnalyticsConsent(cookieValue: string | undefined | null) {
  return getConsent(cookieValue).hasAnalyticsConsent
}

export function getBrowserConsent(): ConsentState {
  if (typeof document === 'undefined') return getConsent(null)

  const cookieValue = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${consentCookieName}=`))
    ?.slice(consentCookieName.length + 1)

  return getConsent(cookieValue)
}

export function buildConsentCookie(
  preferences: ConsentPreferences,
  secure = process.env.NODE_ENV === 'production',
) {
  const parts = [
    `${consentCookieName}=${serializeConsent(preferences)}`,
    'Path=/',
    `Max-Age=${consentMaxAgeSeconds}`,
    'SameSite=Lax',
  ]

  if (secure) parts.push('Secure')

  return parts.join('; ')
}

export function buildClearConsentCookie(
  secure = process.env.NODE_ENV === 'production',
) {
  const parts = [`${consentCookieName}=`, 'Path=/', 'Max-Age=0', 'SameSite=Lax']

  if (secure) parts.push('Secure')

  return parts.join('; ')
}

export function setConsent(analytics: boolean): ConsentPreferences | null {
  if (typeof document === 'undefined') return null

  const preferences = createConsentPreferences(analytics)
  document.cookie = buildConsentCookie(
    preferences,
    window.location.protocol === 'https:',
  )

  return preferences
}

export function clearConsent() {
  if (typeof document === 'undefined') return

  document.cookie = buildClearConsentCookie(
    window.location.protocol === 'https:',
  )
}
