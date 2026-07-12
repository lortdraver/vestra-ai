export const locales = ['az', 'en', 'ru'] as const
export const defaultLocale = 'az'
export const localeCookieName = 'vestra_locale'

export type Locale = (typeof locales)[number]

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale)
}

export function normalizeLocale(value: string | undefined | null): Locale {
  if (!value) return defaultLocale

  const locale = value.toLowerCase().split('-')[0]
  return isLocale(locale) ? locale : defaultLocale
}
