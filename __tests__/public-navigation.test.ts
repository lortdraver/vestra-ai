import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { billingCopy } from '@/lib/billing/copy'
import { faqCopy, siteFooterCopy, supportCopy } from '@/lib/public-content/copy'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const landingPageSource = source('app/page.tsx')
const pricingPageSource = source('app/pricing/page.tsx')
const faqPageSource = source('app/faq/page.tsx')
const supportPageSource = source('app/support/page.tsx')
const dashboardLayoutSource = source('app/dashboard/layout.tsx')
const publicFooterSource = source('components/public-footer.tsx')
const faqAccordionSource = source('components/faq-accordion.tsx')

describe('public navigation and help pages', () => {
  it('adds public FAQ and support routes with metadata and shared footer', () => {
    expect(faqPageSource).toContain('generateMetadata')
    expect(faqPageSource).toContain('faqCopy')
    expect(faqPageSource).toContain('<PublicFooter')
    expect(supportPageSource).toContain('generateMetadata')
    expect(supportPageSource).toContain('supportCopy')
    expect(supportPageSource).toContain('<PublicFooter')
  })

  it('exposes product and legal navigation from the homepage footer', () => {
    expect(landingPageSource).toContain('siteFooterCopy')
    expect(landingPageSource).toContain('<PublicFooter')
    expect(siteFooterCopy.en.product.links.map((link) => link.key)).toEqual([
      'home',
      'wardrobe',
      'stylist',
      'planner',
      'savedLooks',
      'pricing',
    ])
    expect(siteFooterCopy.en.help.links.map((link) => link.key)).toEqual([
      'faq',
      'support',
      'feedback',
    ])
    expect(siteFooterCopy.en.legal.links.map((link) => link.key)).toEqual([
      'privacy',
      'terms',
      'refund',
    ])
    expect(publicFooterSource).toContain('publicProductRoutes')
    expect(publicFooterSource).toContain('authenticatedProductRoutes')
    expect(publicFooterSource).toContain('CookiePreferencesButton')
  })

  it('uses one shared public footer on public informational pages', () => {
    expect(pricingPageSource).toContain('<PublicFooter')
    expect(faqPageSource).toContain('<PublicFooter')
    expect(supportPageSource).toContain('<PublicFooter')
    expect(publicFooterSource).toContain('siteFooterCopy')
  })

  it('mounts one authenticated footer across dashboard product surfaces', () => {
    expect(dashboardLayoutSource).toContain('<PublicFooter')
    expect(dashboardLayoutSource).toContain('authenticated')
    expect(dashboardLayoutSource).toContain(
      'pb-[calc(env(safe-area-inset-bottom)+6.75rem)]',
    )
    expect(publicFooterSource).toContain("wardrobe: '/dashboard/wardrobe'")
    expect(publicFooterSource).toContain("stylist: '/dashboard/stylist'")
    expect(publicFooterSource).toContain("planner: '/dashboard/planner'")
    expect(publicFooterSource).toContain("savedLooks: '/dashboard/outfits'")
  })

  it('keeps pricing and legal support navigation visible on pricing', () => {
    expect(pricingPageSource).toContain('<PublicFooter')
    expect(billingCopy.en.monthlyPrice).toBe('€4.99/month')
    expect(billingCopy.en.annualPrice).toBe('€39.99/year')
  })

  it('ships localized FAQ content with Paddle and privacy disclosures', () => {
    for (const locale of ['az', 'en', 'ru'] as const) {
      const serialized = JSON.stringify(faqCopy[locale])
      expect(serialized).toContain('/pricing')
      expect(serialized).toContain('/privacy')
      expect(serialized).toContain('/terms')
      expect(serialized).toContain('/refund')
      expect(serialized).toContain('/support')
      expect(serialized).toContain('Paddle')
      expect(serialized).toContain('€4.99')
      expect(serialized).toContain('€39.99')
    }
  })

  it('ships localized support content without internal config placeholders', () => {
    for (const locale of ['az', 'en', 'ru'] as const) {
      const serialized = JSON.stringify(supportCopy[locale])
      expect(serialized).not.toContain('PRIVACY_CONTACT_EMAIL')
      expect(serialized).not.toContain('Configure')
      expect(serialized).not.toContain('RESEND_API_KEY')
      expect(serialized).toMatch(/password|Şifr|Парол/i)
      expect(serialized).toMatch(/card|Kart|карт/i)
      expect(serialized).toMatch(/token|токен/i)
    }
  })

  it('keeps the FAQ accordion accessible and mobile-friendly', () => {
    expect(faqAccordionSource).toContain('aria-expanded={isOpen}')
    expect(faqAccordionSource).toContain('aria-controls={panelId}')
    expect(faqAccordionSource).toContain('min-h-14')
    expect(publicFooterSource).toContain('min-h-10')
    expect(publicFooterSource).toContain('sm:grid-cols')
  })

  it('localizes public footer groups for AZ, EN, and RU', () => {
    for (const locale of ['az', 'en', 'ru'] as const) {
      const copy = siteFooterCopy[locale]
      expect(copy.product.links.map((link) => link.key)).toEqual([
        'home',
        'wardrobe',
        'stylist',
        'planner',
        'savedLooks',
        'pricing',
      ])
      expect(copy.help.links.map((link) => link.key)).toEqual([
        'faq',
        'support',
        'feedback',
      ])
      expect(copy.legal.links.map((link) => link.key)).toEqual([
        'privacy',
        'terms',
        'refund',
      ])
      expect(copy.description).toBeTruthy()
      expect(copy.cookiePreferences).toBeTruthy()
      expect(copy.copyright).toBeTruthy()
    }
  })
})
