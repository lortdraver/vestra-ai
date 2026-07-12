import type { Metadata } from 'next'
import { StylistPageClient } from '@/components/stylist/stylist-page-client'
import { getDictionary } from '@/lib/i18n/server'
import { getLocale } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()

  return {
    title: dictionary.dashboard.stylist,
  }
}

export default async function StylistPage() {
  const dictionary = await getDictionary()
  const locale = await getLocale()

  return <StylistPageClient dictionary={dictionary} locale={locale} />
}
