import type { Metadata } from 'next'
import { getLocale } from '@/lib/i18n/server'
import { UserSupportChat } from '@/components/support/user-support-chat'

export const metadata: Metadata = { title: 'Support' }

export default async function SupportChatPage() {
  return <UserSupportChat locale={await getLocale()} />
}
