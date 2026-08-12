'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { getLocalizedAuthErrorMessage } from '@/lib/auth-diagnostics/messages'
import {
  canonicalizeAuthErrorCode,
  extractAuthErrorDetails,
} from '@/lib/auth-diagnostics/shared'
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

  const logSignInDiagnostic = (stage: string, authError?: unknown) => {
    if (isSignUp) return

    const details = authError ? extractAuthErrorDetails(authError) : null
    const logger = stage === 'SIGN_IN_FAILED' ? console.warn : console.info

    logger(`[auth] ${stage}`, {
      httpStatus: details?.status ?? null,
      code: authError ? canonicalizeAuthErrorCode(authError) : null,
      safeMessage: details?.message ?? null,
      requestOrigin: window.location.origin,
      requestHost: window.location.host,
      errorLocation: details?.location ?? null,
      isTopLevelError: details?.isTopLevelError ?? false,
      isNestedBetterFetchError: details?.isNestedBetterFetchError ?? false,
    })
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
      if (!isSignUp) {
        logSignInDiagnostic('SIGN_IN_STARTED')
      }

      const result = isSignUp
        ? await authClient.signUp.email({
            email,
            password,
            name,
            callbackURL: '/verify-email?status=success',
          })
        : await authClient.signIn.email({ email, password })
      const { error } = result

      if (!isSignUp) {
        logSignInDiagnostic('SIGN_IN_RESPONSE_RECEIVED', error)
      }

      if (error) {
        if (!isSignUp) {
          logSignInDiagnostic('SIGN_IN_FAILED', error)
        }
        setError(getLocalizedAuthErrorMessage(dictionary, error))
        return
      }

      if (!isSignUp) {
        logSignInDiagnostic('SIGN_IN_SUCCEEDED')
      }

      router.push(isSignUp ? '/verify-email?status=sent' : '/dashboard')
      router.refresh()
    } catch (authError) {
      const details = extractAuthErrorDetails(authError)

      if (!isSignUp) {
        logSignInDiagnostic('SIGN_IN_FAILED', authError)
      }

      setError(
        details.code || details.message
          ? getLocalizedAuthErrorMessage(dictionary, authError)
          : dictionary.auth.networkError,
      )
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

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        data-clarity-mask="true"
      >
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
