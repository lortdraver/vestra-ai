'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function RecoveryForm({
  dictionary,
  mode,
}: {
  dictionary: Dictionary
  mode: 'forgot' | 'reset'
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const isReset = mode === 'reset'

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(dictionary.auth.resetQueued)
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="font-serif text-2xl font-semibold tracking-tight text-foreground"
        >
          {dictionary.common.brand}
        </Link>
        <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight text-foreground text-balance">
          {isReset
            ? dictionary.auth.resetPasswordTitle
            : dictionary.auth.forgotPasswordTitle}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {isReset
            ? dictionary.auth.resetPasswordIntro
            : dictionary.auth.forgotPasswordIntro}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{dictionary.auth.email}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            placeholder={dictionary.auth.emailPlaceholder}
          />
        </div>

        {isReset && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{dictionary.auth.password}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder={dictionary.auth.newPasswordPlaceholder}
            />
          </div>
        )}

        {message && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}

        <Button type="submit" className="mt-2 w-full">
          {isReset
            ? dictionary.auth.resetPasswordSubmit
            : dictionary.auth.sendResetLink}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {dictionary.common.signIn}
        </Link>
      </p>
    </div>
  )
}
