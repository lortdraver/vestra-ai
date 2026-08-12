'use client'

import { getBrowserConsent } from '@/lib/privacy/consent'
import { sanitizeAnalyticsPath, sanitizeAnalyticsProperties } from './sanitize'

export const clientAnalyticsEventNames = [
  'page_view',
  'sign_up',
  'login',
  'first_wardrobe_item_created',
  'stylist_generation_completed',
  'upgrade_viewed',
  'checkout_started',
] as const

export type ClientAnalyticsEventName =
  (typeof clientAnalyticsEventNames)[number]

type ClientEventProperties = Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    clarity?: (...args: unknown[]) => void
    __vestraGaReady?: boolean
    __vestraClarityReady?: boolean
  }
}

export function canLoadAnalytics() {
  return (
    typeof window !== 'undefined' && getBrowserConsent().hasAnalyticsConsent
  )
}

export function trackClientEvent(
  eventName: ClientAnalyticsEventName,
  properties: ClientEventProperties = {},
) {
  if (!canLoadAnalytics() || typeof window.gtag !== 'function') return false

  const sanitized = sanitizeAnalyticsProperties(properties)
  if (sanitized.rejectedKeys.length > 0) return false

  const eventProperties = { ...sanitized.properties }
  if (eventName === 'page_view' && 'pagePath' in eventProperties) {
    const pagePath = sanitizeAnalyticsPath(String(eventProperties.pagePath))
    if (!pagePath) return false
    delete eventProperties.pagePath
    eventProperties.page_path = pagePath
  }

  window.gtag('event', eventName, eventProperties)
  return true
}
