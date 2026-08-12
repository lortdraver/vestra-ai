'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackClientEvent } from '@/lib/analytics/client'

const gaScriptId = 'vestra-google-analytics-script'
const clarityScriptId = 'vestra-microsoft-clarity-script'
type ClarityFunction = ((...args: unknown[]) => void) & { q?: unknown[] }

const clarityGrantedConsent = {
  ad_Storage: 'denied',
  analytics_Storage: 'granted',
} as const

const clarityDeniedConsent = {
  ad_Storage: 'denied',
  analytics_Storage: 'denied',
} as const

function debug(message: string, details: Record<string, unknown> = {}) {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true') {
    console.info(`[analytics] ${message}`, details)
  }
}

function loadGoogleAnalytics(measurementId: string) {
  if (window.__vestraGaReady) return

  window.dataLayer = window.dataLayer ?? []
  window.gtag =
    window.gtag ?? ((...args: unknown[]) => window.dataLayer?.push(args))
  window.gtag('consent', 'default', { analytics_storage: 'denied' })
  window.gtag('consent', 'update', { analytics_storage: 'granted' })
  window.gtag('js', new Date())
  window.gtag('config', measurementId, { send_page_view: false })

  if (!document.getElementById(gaScriptId)) {
    const script = document.createElement('script')
    script.id = gaScriptId
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    document.head.appendChild(script)
  }

  window.__vestraGaReady = true
  debug('GA4 loaded', { configured: true })
}

function disableGoogleAnalytics() {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'denied' })
  }
  document.getElementById(gaScriptId)?.remove()
  window.__vestraGaReady = false
}

function loadClarity(projectId: string) {
  if (window.__vestraClarityReady) return

  const clarity = (window.clarity ??
    ((...args: unknown[]) => {
      clarity.q = clarity.q ?? []
      clarity.q.push(args)
    })) as ClarityFunction
  window.clarity = clarity
  window.clarity('consentv2', clarityGrantedConsent)

  if (!document.getElementById(clarityScriptId)) {
    const script = document.createElement('script')
    script.id = clarityScriptId
    script.async = true
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`
    document.head.appendChild(script)
  }

  window.__vestraClarityReady = true
  debug('Clarity loaded', { configured: true })
}

function disableClarity() {
  if (typeof window.clarity === 'function') {
    window.clarity('consentv2', clarityDeniedConsent)
    window.clarity('consent', false)
  }
  document.getElementById(clarityScriptId)?.remove()
  window.__vestraClarityReady = false
}

export function OptionalAnalytics({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()
  const lastTrackedPath = useRef<string | null>(null)
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID
  const gaReady = enabled && Boolean(measurementId)

  useEffect(() => {
    if (!enabled) {
      disableGoogleAnalytics()
      disableClarity()
      return
    }

    if (measurementId) loadGoogleAnalytics(measurementId)
    if (clarityProjectId) loadClarity(clarityProjectId)
  }, [clarityProjectId, enabled, measurementId])

  useEffect(() => {
    if (
      !enabled ||
      !gaReady ||
      !pathname ||
      lastTrackedPath.current === pathname
    ) {
      return
    }
    if (trackClientEvent('page_view', { pagePath: pathname })) {
      lastTrackedPath.current = pathname
    }
  }, [enabled, gaReady, pathname])

  return null
}
