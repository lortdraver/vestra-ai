import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { billingCopy } from '@/lib/billing/copy'
import {
  faqCopy,
  publicFooterCopy,
  supportCopy,
} from '@/lib/public-content/copy'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const landingPageSource = source('app/page.tsx')
const pricingPageSource = source('app/pricing/page.tsx')
const faqPageSource = source('app/faq/page.tsx')
const supportPageSource = source('app/support/page.tsx')
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
    expect(landingPageSource).toContain('publicFooterCopy')
    expect(landingPageSource).toContain('<PublicFooter')
    expect(publicFooterCopy.en.product.links.map((link) => link.href)).toEqual([
      '/pricing',
      '/faq',
      '/support',
    ])
    expect(publicFooterCopy.en.legal.links.map((link) => link.href)).toEqual([
      '/privacy',
      '/terms',
      '/refund',
    ])
    expect(publicFooterSource).toContain('copy.product.links')
    expect(publicFooterSource).toContain('copy.legal.links')
    expect(publicFooterSource).toContain('CookiePreferencesButton')
  })

  it('uses one shared public footer on public informational pages', () => {
    expect(pricingPageSource).toContain('<PublicFooter')
    expect(faqPageSource).toContain('<PublicFooter')
    expect(supportPageSource).toContain('<PublicFooter')
    expect(publicFooterSource).toContain('publicFooterCopy')
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
      const copy = publicFooterCopy[locale]
      expect(copy.product.links.map((link) => link.href)).toEqual([
        '/pricing',
        '/faq',
        '/support',
      ])
      expect(copy.legal.links.map((link) => link.href)).toEqual([
        '/privacy',
        '/terms',
        '/refund',
      ])
      expect(copy.cookiePreferences).toBeTruthy()
      expect(copy.copyright).toBeTruthy()
    }
  })
})
