import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/server'
import { WardrobePageClient } from '@/components/wardrobe/wardrobe-page-client'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()

  return {
    title: dictionary.dashboard.wardrobe,
  }
}

export default async function WardrobePage() {
  const dictionary = await getDictionary()

  return <WardrobePageClient dictionary={dictionary} />
}
