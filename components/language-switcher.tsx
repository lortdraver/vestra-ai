'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  defaultLocale,
  localeCookieName,
  locales,
  type Locale,
} from '@/lib/i18n/config'

const languageNames: Record<Locale, string> = {
  az: 'AZ',
  en: 'EN',
  ru: 'RU',
}

export function LanguageSwitcher({
  currentLocale,
  label,
  variant = 'compact',
  onLocaleChange,
}: {
  currentLocale: Locale
  label: string
  variant?: 'compact' | 'menu'
  onLocaleChange?: (locale: Locale) => void
}) {
  const router = useRouter()
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null)
  const [isPending, startTransition] = useTransition()
  const shownLocale = isPending && pendingLocale ? pendingLocale : currentLocale

  const handleChange = (locale: Locale) => {
    if (locale === currentLocale) return
    setPendingLocale(locale)
    // Set the cookie right here instead of waiting for a server round trip,
    // then re-render the page in the new language.
    writeLocaleCookie(locale)
    onLocaleChange?.(locale)
    startTransition(() => router.refresh())
  }

  return (
    <div
      className={cn(
        variant === 'compact'
          ? 'flex items-center gap-0.5 sm:gap-1'
          : 'grid grid-cols-3 gap-2',
      )}
      aria-label={label}
      aria-busy={isPending}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => handleChange(locale)}
          className={cn(
            'grid place-items-center rounded-md text-xs font-medium transition-colors disabled:cursor-wait disabled:opacity-70 hover:bg-secondary hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground',
            variant === 'compact'
              ? 'min-h-9 min-w-9 px-1.5 text-muted-foreground sm:min-h-8 sm:min-w-8 sm:px-2'
              : 'min-h-11 min-w-11 px-3 text-foreground',
          )}
          aria-pressed={locale === shownLocale}
          disabled={isPending}
        >
          {languageNames[locale] ?? languageNames[defaultLocale]}
        </button>
      ))}
    </div>
  )
}

function writeLocaleCookie(locale: Locale) {
  document.cookie = `${localeCookieName}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}
