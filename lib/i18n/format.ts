import type { Locale } from './config'

export function toIntlLocale(locale: Locale) {
  switch (locale) {
    case 'az':
      return 'az-Latn-AZ'
    case 'ru':
      return 'ru-RU'
    case 'en':
    default:
      return 'en-GB'
  }
}

/**
 * Formats a date in the site language ("1 dek 2026", "1 дек. 2026 г.",
 * "1 Dec 2026"). `toLocaleDateString()` without a locale uses the server's
 * locale, which rendered US dates such as "12/1/2026" for every language.
 */
export function formatDate(value: Date | string, locale: Locale) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: 'medium',
  }).format(date)
}
