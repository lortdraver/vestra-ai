import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getRefundCopy, getTermsCopy } from '@/lib/legal/copy'
import { publicFooterCopy } from '@/lib/public-content/copy'
import { consentCopy, getPrivacyPolicyCopy } from '@/lib/privacy/copy'
import {
  buildClearConsentCookie,
  buildConsentCookie,
  consentCookieName,
  consentMaxAgeSeconds,
  consentPolicyVersion,
  consentVersion,
  createConsentPreferences,
  getConsent,
  hasAnalyticsConsent,
  parseConsentCookieValue,
  serializeConsent,
} from '@/lib/privacy/consent'

const rootLayoutSource = readFileSync(
  join(process.cwd(), 'app/layout.tsx'),
  'utf8',
)
const consentManagerSource = readFileSync(
  join(process.cwd(), 'components/privacy/consent-manager.tsx'),
  'utf8',
)
const privacyPageSource = readFileSync(
  join(process.cwd(), 'app/privacy/page.tsx'),
  'utf8',
)
const termsPageSource = readFileSync(
  join(process.cwd(), 'app/terms/page.tsx'),
  'utf8',
)
const refundPageSource = readFileSync(
  join(process.cwd(), 'app/refund/page.tsx'),
  'utf8',
)
const landingPageSource = readFileSync(
  join(process.cwd(), 'app/page.tsx'),
  'utf8',
)
const publicFooterSource = readFileSync(
  join(process.cwd(), 'components/public-footer.tsx'),
  'utf8',
)
const appHeaderSource = readFileSync(
  join(process.cwd(), 'components/app-header.tsx'),
  'utf8',
)
const optionalAnalyticsSource = readFileSync(
  join(process.cwd(), 'components/analytics/optional-analytics.tsx'),
  'utf8',
)
const clientAnalyticsSource = readFileSync(
  join(process.cwd(), 'lib/analytics/client.ts'),
  'utf8',
)
const authFormSource = readFileSync(
  join(process.cwd(), 'components/auth-form.tsx'),
  'utf8',
)
const wardrobeSource = readFileSync(
  join(process.cwd(), 'components/wardrobe/wardrobe-page-client.tsx'),
  'utf8',
)
const stylistSource = readFileSync(
  join(process.cwd(), 'components/stylist/stylist-page-client.tsx'),
  'utf8',
)

describe('privacy consent architecture', () => {
  it('returns no decision when there is no previous consent', () => {
    expect(getConsent(null)).toEqual({
      preferences: null,
      hasDecision: false,
      hasAnalyticsConsent: false,
      requiresRefresh: false,
    })
  })

  it('stores accepted analytics consent with necessary always true', () => {
    const preferences = createConsentPreferences(
      true,
      new Date('2026-08-12T00:00:00.000Z'),
    )

    expect(preferences).toMatchObject({
      version: consentVersion,
      necessary: true,
      analytics: true,
      policyVersion: consentPolicyVersion,
    })
    expect(getConsent(serializeConsent(preferences))).toMatchObject({
      hasDecision: true,
      hasAnalyticsConsent: true,
      requiresRefresh: false,
    })
  })

  it('stores rejected analytics consent while preserving necessary cookies', () => {
    const preferences = createConsentPreferences(false)
    const parsed = parseConsentCookieValue(serializeConsent(preferences))

    expect(parsed?.necessary).toBe(true)
    expect(parsed?.analytics).toBe(false)
    expect(hasAnalyticsConsent(serializeConsent(preferences))).toBe(false)
    expect(getConsent(serializeConsent(preferences)).hasDecision).toBe(true)
  })

  it('restores saved consent from the cookie value', () => {
    const preferences = createConsentPreferences(true)
    const restored = parseConsentCookieValue(serializeConsent(preferences))

    expect(restored).toEqual(preferences)
  })

  it('requires a new decision when consent version changes', () => {
    const preferences = {
      ...createConsentPreferences(true),
      version: consentVersion - 1,
    }

    expect(getConsent(serializeConsent(preferences))).toMatchObject({
      hasDecision: false,
      hasAnalyticsConsent: false,
      requiresRefresh: true,
    })
  })

  it('ignores corrupted consent cookies', () => {
    expect(parseConsentCookieValue('%7Bbad-json')).toBeNull()
    expect(getConsent('%7Bbad-json')).toMatchObject({
      hasDecision: false,
      hasAnalyticsConsent: false,
    })
  })

  it('builds secure minimal first-party consent cookies', () => {
    const cookie = buildConsentCookie(createConsentPreferences(true), true)

    expect(cookie).toContain(`${consentCookieName}=`)
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain(`Max-Age=${consentMaxAgeSeconds}`)
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
    expect(cookie).not.toContain('userId')
    expect(cookie).not.toContain('email')
  })

  it('can clear consent without touching auth cookies', () => {
    const cookie = buildClearConsentCookie(true)

    expect(cookie).toContain(`${consentCookieName}=`)
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).not.toContain('better-auth')
  })

  it('keeps Vercel Analytics behind the consent manager', () => {
    expect(rootLayoutSource).not.toContain('@vercel/analytics/next')
    expect(rootLayoutSource).toContain('<ConsentManager')
    expect(consentManagerSource).toContain('@vercel/analytics/next')
    expect(consentManagerSource).toContain(
      'consent.hasAnalyticsConsent && <Analytics />',
    )
  })

  it('keeps GA4 and Clarity behind the same consent authority', () => {
    expect(consentManagerSource).toContain('<OptionalAnalytics')
    expect(optionalAnalyticsSource).toContain('enabled')
    expect(optionalAnalyticsSource).toContain('googletagmanager.com/gtag/js')
    expect(optionalAnalyticsSource).toContain('www.clarity.ms/tag/')
    expect(optionalAnalyticsSource).toContain("analytics_storage: 'denied'")
    expect(optionalAnalyticsSource).toContain("window.clarity('consentv2'")
    expect(optionalAnalyticsSource).toContain("analytics_Storage: 'granted'")
    expect(optionalAnalyticsSource).toContain("consent', false")
    expect(clientAnalyticsSource).toContain('getBrowserConsent')
    expect(clientAnalyticsSource).toContain('sanitizeAnalyticsProperties')
  })

  it('marks sensitive user input regions for Clarity masking', () => {
    expect(authFormSource).toContain('data-clarity-mask="true"')
    expect(wardrobeSource).toContain('data-clarity-mask="true"')
    expect(stylistSource).toContain('data-clarity-mask="true"')
  })

  it('provides accept, reject, and preference update actions', () => {
    expect(consentManagerSource).toContain('acceptAnalytics')
    expect(consentManagerSource).toContain('rejectAnalytics')
    expect(consentManagerSource).toContain('savePreferences')
    expect(consentManagerSource).toContain('setAnalyticsEnabled')
  })

  it('makes the privacy route public and localized', () => {
    expect(privacyPageSource).not.toContain('auth.api.getSession')
    expect(privacyPageSource).not.toContain('redirect(')
    expect(privacyPageSource).toContain('getPrivacyPolicyCopy')
    expect(getPrivacyPolicyCopy('az').title).toBe('Məxfilik siyasəti')
    expect(getPrivacyPolicyCopy('en').title).toBe('Privacy Policy')
    expect(getPrivacyPolicyCopy('ru').title).toBe('Политика конфиденциальности')
  })

  it('does not expose internal privacy configuration instructions publicly', () => {
    expect(getPrivacyPolicyCopy('en').contactFallback).not.toContain(
      'Configure',
    )
    expect(getPrivacyPolicyCopy('az').contactFallback).not.toContain('PRIVACY')
    expect(getPrivacyPolicyCopy('ru').contactFallback).not.toContain('PRIVACY')
    expect(
      getPrivacyPolicyCopy('en', 'privacy@example.com').contactFallback,
    ).toBe('privacy@example.com')
  })

  it('ships clean UTF-8 privacy and consent copy', () => {
    const serialized = JSON.stringify({
      consentCopy,
      az: getPrivacyPolicyCopy('az'),
      ru: getPrivacyPolicyCopy('ru'),
    })

    expect(serialized).toContain('Məxfilik')
    expect(serialized).toContain('Политика конфиденциальности')
    expect(serialized).not.toContain('MЙ')
    expect(serialized).not.toContain('Рџ')
    expect(serialized).not.toContain('Рќ')
  })

  it('discloses Paddle payment processing without raw card storage', () => {
    expect(JSON.stringify(getPrivacyPolicyCopy('en'))).toContain(
      'Vestra does not store raw card details',
    )
    expect(JSON.stringify(getTermsCopy('en'))).toContain(
      'Paid subscriptions are processed by Paddle',
    )
    expect(JSON.stringify(getRefundCopy('en'))).toContain(
      'Payments are processed by Paddle',
    )
  })

  it('adds public terms and refund pages without authentication', () => {
    expect(termsPageSource).not.toContain('auth.api.getSession')
    expect(termsPageSource).not.toContain('redirect(')
    expect(termsPageSource).toContain('getTermsCopy')
    expect(refundPageSource).not.toContain('auth.api.getSession')
    expect(refundPageSource).not.toContain('redirect(')
    expect(refundPageSource).toContain('getRefundCopy')
    expect(getTermsCopy('az').title).toBe('İstifadə şərtləri')
    expect(getRefundCopy('ru').title).toBe('Политика возвратов и отмены')
  })

  it('exposes cookie preferences from public and authenticated surfaces', () => {
    expect(landingPageSource).toContain('<PublicFooter')
    expect(publicFooterCopy.en.legal.links.map((link) => link.href)).toEqual([
      '/privacy',
      '/terms',
      '/refund',
    ])
    expect(publicFooterSource).toContain('copy.legal.links')
    expect(publicFooterSource).toContain('CookiePreferencesButton')
    expect(appHeaderSource).toContain('openCookiePreferences')
    expect(appHeaderSource).toContain('dictionary.privacy.cookiePreferences')
  })

  it('keeps the mobile consent layout clear of the bottom navigation', () => {
    expect(consentManagerSource).toContain(
      'env(safe-area-inset-bottom)+4.75rem',
    )
    expect(consentManagerSource).toContain('max-w-[calc(100vw-1rem)]')
    expect(consentManagerSource).toContain('100svh')
    expect(consentManagerSource).toContain('min-[390px]:grid-cols-3')
  })

  it('ships AZ, EN, and RU consent copy', () => {
    expect(consentCopy.az.bannerTitle).toBe('Məxfilik seçimləriniz')
    expect(consentCopy.en.analyticsTitle).toBe('Analytics')
    expect(consentCopy.ru.rejectAnalytics).toBe('Отклонить аналитику')
  })
})
