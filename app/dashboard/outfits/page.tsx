import type { Metadata } from 'next'
import { OutfitsPageClient } from '@/components/outfits/outfits-page-client'
import { getDictionary } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()

  return {
    title: dictionary.dashboard.outfits,
  }
}

export default async function OutfitsPage() {
  const dictionary = await getDictionary()

  return <OutfitsPageClient dictionary={dictionary} />
}
