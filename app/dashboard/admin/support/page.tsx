import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getLocale } from '@/lib/i18n/server'
import { getSupportSessionUser } from '@/lib/support/auth'
import { AdminSupportInbox } from '@/components/support/admin-support-inbox'

export const metadata: Metadata = { title: 'Support inbox' }

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>
}) {
  const currentUser = await getSupportSessionUser()
  if (!currentUser) redirect('/sign-in')
  if (!currentUser.isAdmin) notFound()
  const { thread } = await searchParams

  return (
    <AdminSupportInbox
      locale={await getLocale()}
      initialThreadId={thread ?? null}
    />
  )
}
