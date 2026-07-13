import { describe, expect, it } from 'vitest'
import { defaultLocale, locales, normalizeLocale } from '@/lib/i18n/config'
import { dictionaries } from '@/lib/i18n/dictionaries'

describe('i18n foundation', () => {
  it('defaults to Azerbaijani', () => {
    expect(defaultLocale).toBe('az')
    expect(normalizeLocale(undefined)).toBe('az')
    expect(normalizeLocale('fr-FR')).toBe('az')
  })

  it('supports Azerbaijani, English, and Russian dictionaries', () => {
    expect(locales).toEqual(['az', 'en', 'ru'])

    for (const locale of locales) {
      expect(dictionaries[locale].common.brand).toBe('Vestra')
      expect(dictionaries[locale].landing.headline).toBeTruthy()
      expect(dictionaries[locale].auth.genericError).toBeTruthy()
    }
  })

  it('localizes stylist provider-format errors', () => {
    for (const locale of locales) {
      expect(dictionaries[locale].stylist.errors.providerFormat).toBeTruthy()
      expect(dictionaries[locale].stylist.errors.providerFormat).not.toBe(
        dictionaries[locale].stylist.errors.generate,
      )
    }
  })
})
