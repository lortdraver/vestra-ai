'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { defaultLocale, locales, type Locale } from '@/lib/i18n/config'

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

  const handleChange = async (locale: Locale) => {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    onLocaleChange?.(locale)
    router.refresh()
  }

  return (
    <div
      className={cn(
        variant === 'compact'
          ? 'flex items-center gap-0.5 sm:gap-1'
          : 'grid grid-cols-3 gap-2',
      )}
      aria-label={label}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => handleChange(locale)}
          className={cn(
            'grid place-items-center rounded-md text-xs font-medium transition-colors hover:bg-secondary hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground',
            variant === 'compact'
              ? 'min-h-9 min-w-9 px-1.5 text-muted-foreground sm:min-h-8 sm:min-w-8 sm:px-2'
              : 'min-h-11 min-w-11 px-3 text-foreground',
          )}
          aria-pressed={locale === currentLocale}
        >
          {languageNames[locale] ?? languageNames[defaultLocale]}
        </button>
      ))}
    </div>
  )
}
