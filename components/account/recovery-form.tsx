'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  isPotentialPasswordResetToken,
  passwordResetConfig,
  validatePasswordResetPassword,
  type PasswordResetCode,
} from '@/lib/password-reset'

export function RecoveryForm({
  dictionary,
  mode,
}: {
  dictionary: Dictionary
  mode: 'forgot' | 'reset'
}) {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const isReset = mode === 'reset'
  const token = searchParams.get('token')
  const resetError = searchParams.get('error')
  const hasValidToken = !isReset || isPotentialPasswordResetToken(token)

  const getErrorMessage = (code: string | undefined) => {
    const errors = dictionary.auth.passwordResetErrors

    switch (code as PasswordResetCode | undefined) {
      case 'password_reset_rate_limited':
        return errors.rateLimited
      case 'password_reset_email_delivery_failed':
        return errors.emailDeliveryFailed
      case 'password_reset_invalid_token':
        return errors.invalidToken
      case 'password_reset_expired_token':
        return errors.expiredToken
      case 'password_reset_token_used':
        return errors.tokenUsed
      case 'password_reset_invalid_password':
        return errors.invalidPassword
      default:
        return errors.failed
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (isReset) {
      if (!isPotentialPasswordResetToken(token)) {
        setError(dictionary.auth.passwordResetErrors.invalidToken)
        return
      }

      if (password !== confirmPassword) {
        setError(dictionary.auth.passwordResetErrors.passwordMismatch)
        return
      }

      if (!validatePasswordResetPassword(password)) {
        setError(dictionary.auth.passwordResetErrors.invalidPassword)
        return
      }
    }

    setLoading(true)

    try {
      const response = await fetch(
        isReset
          ? '/api/account/reset-password'
          : '/api/account/request-password-reset',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isReset
              ? {
                  token,
                  newPassword: password,
                }
              : { email },
          ),
        },
      )
      const data = (await response.json().catch(() => null)) as {
        code?: string
      } | null

      if (!response.ok) {
        setError(getErrorMessage(data?.code))
        return
      }

      if (isReset) {
        setSuccess(true)
        setMessage(dictionary.auth.passwordResetSuccess)
      } else {
        setMessage(dictionary.auth.resetQueued)
      }
    } catch {
      setError(dictionary.auth.networkError)
    } finally {
      setLoading(false)
    }
  }

  if (isReset && (resetError || !hasValidToken)) {
    return (
      <RecoveryShell dictionary={dictionary} isReset>
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {dictionary.auth.passwordResetErrors.invalidToken}
        </div>
        <AuthLink dictionary={dictionary} />
      </RecoveryShell>
    )
  }

  if (success) {
    return (
      <RecoveryShell dictionary={dictionary} isReset>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {dictionary.auth.passwordResetSuccess}
        </div>
        <Link
          href="/sign-in"
          className={buttonVariants({ className: 'mt-2 w-full' })}
        >
          {dictionary.common.signIn}
        </Link>
      </RecoveryShell>
    )
  }

  return (
    <RecoveryShell dictionary={dictionary} isReset={isReset}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        data-clarity-mask="true"
      >
        {!isReset && (
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
        )}

        {isReset && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{dictionary.auth.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={passwordResetConfig.minPasswordLength}
                maxLength={passwordResetConfig.maxPasswordLength}
                autoComplete="new-password"
                placeholder={dictionary.auth.newPasswordPlaceholder}
              />
              <p className="text-xs text-muted-foreground">
                {dictionary.auth.passwordRequirements}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">
                {dictionary.auth.confirmPassword}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={passwordResetConfig.minPasswordLength}
                maxLength={passwordResetConfig.maxPasswordLength}
                autoComplete="new-password"
                placeholder={dictionary.auth.confirmPasswordPlaceholder}
              />
            </div>
          </>
        )}

        {message && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading
            ? dictionary.common.loading
            : isReset
              ? dictionary.auth.resetPasswordSubmit
              : dictionary.auth.sendResetLink}
        </Button>
      </form>

      <AuthLink dictionary={dictionary} />
    </RecoveryShell>
  )
}

function RecoveryShell({
  dictionary,
  isReset,
  children,
}: {
  dictionary: Dictionary
  isReset: boolean
  children: React.ReactNode
}) {
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
      {children}
    </div>
  )
}

function AuthLink({ dictionary }: { dictionary: Dictionary }) {
  return (
    <p className="mt-6 text-center text-sm text-muted-foreground">
      <Link
        href="/sign-in"
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {dictionary.common.signIn}
      </Link>
    </p>
  )
}
