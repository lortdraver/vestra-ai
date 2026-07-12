import { cookies, headers } from 'next/headers'
import {
  defaultLocale,
  localeCookieName,
  normalizeLocale,
  type Locale,
} from './config'
import { dictionaries } from './dictionaries'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(localeCookieName)?.value

  if (cookieLocale) {
    return normalizeLocale(cookieLocale)
  }

  const headerStore = await headers()
  return normalizeLocale(
    headerStore.get('accept-language')?.split(',')[0] ?? defaultLocale,
  )
}

export async function getDictionary() {
  const locale = await getLocale()
  return dictionaries[locale]
}
