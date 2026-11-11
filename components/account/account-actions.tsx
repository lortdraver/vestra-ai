'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Mode = 'idle' | 'editProfile' | 'deleteAccount'

export function AccountActions({
  dictionary,
  currentName,
}: {
  dictionary: Dictionary
  currentName: string
}) {
  const t = dictionary.account
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')
  const [name, setName] = useState(currentName)
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{
    tone: 'ok' | 'error'
    text: string
  } | null>(null)

  const reset = () => {
    setMode('idle')
    setPassword('')
    setPending(false)
  }

  const handleLogout = async () => {
    try {
      await authClient.signOut()
    } finally {
      router.push('/sign-in')
      router.refresh()
    }
  }

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim().slice(0, 80)
    if (!trimmed) return
    setPending(true)
    setMessage(null)
    const { error } = await authClient.updateUser({ name: trimmed })
    setPending(false)
    if (error) {
      setMessage({ tone: 'error', text: t.profileSaveFailed })
      return
    }
    setMessage({ tone: 'ok', text: t.profileSaved })
    setMode('idle')
    router.refresh()
  }

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password) return
    setPending(true)
    setMessage(null)
    const { error } = await authClient.deleteUser({ password })
    if (error) {
      setPending(false)
      setMessage({
        tone: 'error',
        text:
          error.code === 'active_subscription'
            ? t.deleteAccountActiveSubscription
            : t.deleteAccountFailed,
      })
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="grid gap-3">
      {mode === 'editProfile' ? (
        <form className="grid gap-2" onSubmit={handleSaveProfile}>
          <Label htmlFor="account-name">{t.nameLabel}</Label>
          <Input
            id="account-name"
            value={name}
            maxLength={80}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !name.trim()}>
              {t.saveProfile}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setMessage(null)
            setMode('editProfile')
          }}
        >
          {t.editProfile}
        </Button>
      )}

      <Button type="button" variant="outline" onClick={handleLogout}>
        {t.logout}
      </Button>

      {mode === 'deleteAccount' ? (
        <form
          className="grid gap-2 rounded-lg border border-destructive/30 p-3"
          onSubmit={handleDeleteAccount}
        >
          <p className="text-sm text-muted-foreground">{t.deleteAccountBody}</p>
          <Label htmlFor="account-delete-password">
            {t.deleteAccountPasswordLabel}
          </Label>
          <Input
            id="account-delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || !password}
            >
              {t.deleteAccountConfirm}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setMessage(null)
            setMode('deleteAccount')
          }}
        >
          {t.deleteAccount}
        </Button>
      )}

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={
            message.tone === 'error'
              ? 'text-sm text-destructive'
              : 'text-sm text-muted-foreground'
          }
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
