import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { WardrobePageClient } from '@/components/wardrobe/wardrobe-page-client'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()

  return {
    title: dictionary.dashboard.wardrobe,
  }
}

export default async function WardrobePage() {
  const dictionary = await getDictionary()
  const locale = await getLocale()

  return <WardrobePageClient dictionary={dictionary} locale={locale} />
}
