'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function AuthForm({
  mode,
  dictionary,
}: {
  mode: 'sign-in' | 'sign-up'
  dictionary: Dictionary
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'sign-up'

  const getAuthErrorMessage = (authError: unknown) => {
    const value =
      typeof authError === 'object' && authError !== null
        ? `${'code' in authError ? authError.code : ''} ${
            'message' in authError ? authError.message : ''
          }`
        : String(authError)
    const normalized = value.toLowerCase()

    if (normalized.includes('email') && normalized.includes('invalid')) {
      return dictionary.auth.invalidEmail
    }
    if (normalized.includes('password')) {
      return dictionary.auth.wrongPassword
    }
    if (normalized.includes('not_found') || normalized.includes('not found')) {
      return dictionary.auth.accountNotFound
    }
    if (normalized.includes('exists') || normalized.includes('already')) {
      return dictionary.auth.accountAlreadyExists
    }
    if (normalized.includes('rate') || normalized.includes('too many')) {
      return dictionary.auth.tooManyAttempts
    }

    return dictionary.auth.genericError
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.includes('@')) {
      setError(dictionary.auth.invalidEmail)
      return
    }

    setLoading(true)

    try {
      const { error } = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password })

      if (error) {
        setError(getAuthErrorMessage(error))
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError(dictionary.auth.networkError)
    } finally {
      setLoading(false)
    }
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
          {isSignUp
            ? dictionary.auth.createAccount
            : dictionary.auth.welcomeBack}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {isSignUp ? dictionary.auth.signUpIntro : dictionary.auth.signInIntro}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{dictionary.auth.name}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder={dictionary.auth.namePlaceholder}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{dictionary.auth.email}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={dictionary.auth.emailPlaceholder}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{dictionary.auth.password}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder={
              isSignUp
                ? dictionary.auth.newPasswordPlaceholder
                : dictionary.auth.passwordPlaceholder
            }
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading
            ? dictionary.common.loading
            : isSignUp
              ? dictionary.auth.submitSignUp
              : dictionary.auth.submitSignIn}
        </Button>
      </form>

      {!isSignUp && (
        <p className="mt-3 text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {dictionary.auth.forgotPassword}
          </Link>
        </p>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp
          ? dictionary.auth.alreadyHaveAccount
          : dictionary.auth.newToVestra}{' '}
        <Link
          href={isSignUp ? '/sign-in' : '/sign-up'}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isSignUp ? dictionary.common.signIn : dictionary.common.signUp}
        </Link>
      </p>
    </div>
  )
}
