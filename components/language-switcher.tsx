'use client'

import { useRouter } from 'next/navigation'
import { defaultLocale, locales, type Locale } from '@/lib/i18n/config'

const languageNames: Record<Locale, string> = {
  az: 'AZ',
  en: 'EN',
  ru: 'RU',
}

export function LanguageSwitcher({
  currentLocale,
  label,
}: {
  currentLocale: Locale
  label: string
}) {
  const router = useRouter()

  const handleChange = async (locale: Locale) => {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    router.refresh()
  }

  return (
    <div className="flex items-center gap-0.5 sm:gap-1" aria-label={label}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => handleChange(locale)}
          className="grid min-h-9 min-w-9 place-items-center rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:min-h-8 sm:min-w-8 sm:px-2"
          aria-pressed={locale === currentLocale}
        >
          {languageNames[locale] ?? languageNames[defaultLocale]}
        </button>
      ))}
    </div>
  )
}
