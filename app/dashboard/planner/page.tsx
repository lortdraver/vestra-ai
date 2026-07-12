import type { Metadata } from 'next'
import { getLocale } from '@/lib/i18n/server'
import { PlannerPageClient } from '@/components/planner/planner-page-client'

export const metadata: Metadata = {
  title: 'Planner',
}

export default async function PlannerPage() {
  const locale = await getLocale()
  return <PlannerPageClient locale={locale} />
}
