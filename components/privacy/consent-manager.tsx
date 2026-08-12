'use client'

import { Analytics } from '@vercel/analytics/next'
import { OptionalAnalytics } from '@/components/analytics/optional-analytics'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type { ConsentCopy } from '@/lib/privacy/copy'
import {
  getBrowserConsent,
  setConsent,
  type ConsentState,
} from '@/lib/privacy/consent'
import { cn } from '@/lib/utils'

export const openCookiePreferencesEvent = 'vestra:open-cookie-preferences'

export function ConsentManager({
  copy,
  initialConsent,
}: {
  copy: ConsentCopy
  initialConsent: ConsentState
}) {
  const [consent, setConsentState] = useState(initialConsent)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    initialConsent.hasAnalyticsConsent,
  )
  const [status, setStatus] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const showBanner = !consent.hasDecision

  useEffect(() => {
    function openPreferences() {
      setStatus(null)
      setAnalyticsEnabled(getBrowserConsent().hasAnalyticsConsent)
      setDialogOpen(true)
    }

    window.addEventListener(openCookiePreferencesEvent, openPreferences)
    return () =>
      window.removeEventListener(openCookiePreferencesEvent, openPreferences)
  }, [])

  useEffect(() => {
    if (!dialogOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDialogOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    const firstControl =
      dialogRef.current?.querySelector<HTMLElement>('button, input, a')
    firstControl?.focus()

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialogOpen])

  const persist = (analytics: boolean) => {
    const preferences = setConsent(analytics)
    const next = getBrowserConsent()
    setConsentState(next)
    setAnalyticsEnabled(Boolean(preferences?.analytics))
    setStatus(copy.saved)
    setDialogOpen(false)
  }

  return (
    <>
      {consent.hasAnalyticsConsent && <Analytics />}
      <OptionalAnalytics enabled={consent.hasAnalyticsConsent} />

      {showBanner && (
        <section
          aria-label={copy.bannerTitle}
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-50 mx-auto w-full max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur md:bottom-4 md:max-w-[58rem] md:p-4"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">
                {copy.bannerTitle}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
                {copy.bannerBody}{' '}
                <Link
                  href="/privacy"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {copy.cookiePreferences}
                </Link>
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-1 gap-2 min-[390px]:grid-cols-3 md:flex">
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-10')}
                onClick={() => persist(false)}
              >
                {copy.rejectAnalytics}
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-10')}
                onClick={() => setDialogOpen(true)}
              >
                {copy.managePreferences}
              </button>
              <button
                type="button"
                className={cn(buttonVariants(), 'h-10')}
                onClick={() => persist(true)}
              >
                {copy.acceptAnalytics}
              </button>
            </div>
          </div>
        </section>
      )}

      {consent.hasDecision && (
        <button
          type="button"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] left-3 z-40 rounded-full border border-border bg-background/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:bottom-4"
          onClick={() => setDialogOpen(true)}
        >
          {copy.cookiePreferences}
        </button>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-end bg-foreground/25 p-3 backdrop-blur-sm md:place-items-center md:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false)
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-preferences-title"
            aria-describedby="cookie-preferences-description"
            className="max-h-[calc(100svh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl md:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="cookie-preferences-title"
                  className="font-serif text-2xl font-medium text-foreground"
                >
                  {copy.dialogTitle}
                </h2>
                <p
                  id="cookie-preferences-description"
                  className="mt-2 text-sm leading-relaxed text-muted-foreground"
                >
                  {copy.dialogDescription}
                </p>
              </div>
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                )}
                onClick={() => setDialogOpen(false)}
                aria-label={copy.close}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <section className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {copy.necessaryTitle}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {copy.necessaryBody}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                    <Check className="size-3" aria-hidden="true" />
                    {copy.alwaysActive}
                  </span>
                </div>
              </section>

              <section className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {copy.analyticsTitle}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {copy.analyticsBody}
                    </p>
                  </div>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={analyticsEnabled}
                      onChange={(event) =>
                        setAnalyticsEnabled(event.target.checked)
                      }
                      aria-label={copy.analyticsToggleLabel}
                    />
                    <span className="h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50" />
                    <span className="absolute left-1 size-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-5" />
                  </label>
                </div>
              </section>
            </div>

            {status && (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                {status}
              </p>
            )}

            <div className="mt-5 grid gap-2 min-[390px]:grid-cols-3">
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-10')}
                onClick={() => persist(false)}
              >
                {copy.rejectAnalytics}
              </button>
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-10')}
                onClick={() => persist(analyticsEnabled)}
              >
                {copy.savePreferences}
              </button>
              <button
                type="button"
                className={cn(buttonVariants(), 'h-10')}
                onClick={() => persist(true)}
              >
                {copy.acceptAnalytics}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function openCookiePreferences() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(openCookiePreferencesEvent))
}
