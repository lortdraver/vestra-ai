'use client'

import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function AccountActions({ dictionary }: { dictionary: Dictionary }) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await authClient.signOut()
    } finally {
      router.push('/sign-in')
      router.refresh()
    }
  }

  return (
    <>
      <Button type="button" variant="outline">
        {dictionary.account.editProfile}
      </Button>
      <Button type="button" variant="outline">
        {dictionary.account.changeLanguage}
      </Button>
      <Button type="button" variant="outline" onClick={handleLogout}>
        {dictionary.account.logout}
      </Button>
      <Button type="button" variant="destructive">
        {dictionary.account.deleteAccount}
      </Button>
      <p className="text-sm text-muted-foreground">
        {dictionary.account.deleteAccountBody}
      </p>
    </>
  )
}
