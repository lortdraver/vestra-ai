import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAccountEmailTemplate } from '@/lib/account/email-templates'
import { dictionaries } from '@/lib/i18n/dictionaries'
import {
  buildPasswordResetUrl,
  createPasswordResetErrorPayload,
  getPasswordResetCallbackPath,
  getPasswordResetPublicSuccessPayload,
  isPotentialPasswordResetToken,
  passwordResetConfig,
  validatePasswordResetPassword,
} from '@/lib/password-reset'
import {
  checkRateLimit,
  resetRateLimitBuckets,
} from '@/lib/security/rate-limit'

const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  }
  resetRateLimitBuckets()
  vi.restoreAllMocks()
})

describe('password reset link safety', () => {
  it('uses the local configured app origin outside production', () => {
    const url = new URL(buildPasswordResetUrl('reset-token-1234567890'))

    expect(url.origin).toBe('http://localhost:3000')
    expect(url.pathname).toBe('/reset-password')
    expect(url.searchParams.get('token')).toBe('reset-token-1234567890')
  })

  it('uses the canonical Vestra production origin in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_APP_URL = 'https://evil.example'

    const url = new URL(buildPasswordResetUrl('reset-token-1234567890'))

    expect(url.origin).toBe('https://vestraapp.uk')
    expect(url.pathname).toBe('/reset-password')
  })

  it('uses the reset page as Better Auth redirect target', () => {
    expect(getPasswordResetCallbackPath()).toBe('/reset-password')
  })
})

describe('password reset validation', () => {
  it('accepts Better Auth-style reset tokens', () => {
    expect(isPotentialPasswordResetToken('AbcDef_1234567890-xyz')).toBe(true)
  })

  it('rejects missing or malformed tokens', () => {
    expect(isPotentialPasswordResetToken(null)).toBe(false)
    expect(isPotentialPasswordResetToken('short')).toBe(false)
    expect(isPotentialPasswordResetToken('token with spaces')).toBe(false)
  })

  it('keeps client password length aligned with Better Auth defaults', () => {
    expect(passwordResetConfig.minPasswordLength).toBe(8)
    expect(passwordResetConfig.maxPasswordLength).toBe(128)
    expect(validatePasswordResetPassword('1234567')).toBe(false)
    expect(validatePasswordResetPassword('12345678')).toBe(true)
    expect(validatePasswordResetPassword('x'.repeat(128))).toBe(true)
    expect(validatePasswordResetPassword('x'.repeat(129))).toBe(false)
  })

  it('returns a neutral public request response', () => {
    expect(getPasswordResetPublicSuccessPayload()).toEqual({
      ok: true,
      status: 'sent',
    })
  })

  it('creates stable structured password reset errors', () => {
    expect(
      createPasswordResetErrorPayload({
        code: 'password_reset_invalid_token',
        stage: 'PASSWORD_RESET_STARTED',
        message: 'Invalid token.',
      }),
    ).toEqual({
      ok: false,
      error: 'password_reset_invalid_token',
      code: 'password_reset_invalid_token',
      stage: 'PASSWORD_RESET_STARTED',
      message: 'Invalid token.',
    })
  })
})

describe('password reset email copy', () => {
  it.each(['az', 'en', 'ru'] as const)(
    'builds localized reset email for %s',
    (locale) => {
      const template = buildAccountEmailTemplate({
        kind: 'password_reset',
        locale,
        actionUrl: 'https://vestraapp.uk/reset-password?token=redacted',
      })

      expect(template.subject.length).toBeGreaterThan(0)
      expect(template.text).toContain('https://vestraapp.uk/reset-password')
      expect(template.html).toContain('href=')
    },
  )

  it.each(['az', 'en', 'ru'] as const)(
    'has localized UI errors for %s',
    (locale) => {
      const errors = dictionaries[locale].auth.passwordResetErrors

      expect(errors.rateLimited).toBeTruthy()
      expect(errors.emailDeliveryFailed).toBeTruthy()
      expect(errors.invalidToken).toBeTruthy()
      expect(errors.expiredToken).toBeTruthy()
      expect(errors.tokenUsed).toBeTruthy()
      expect(errors.invalidPassword).toBeTruthy()
      expect(errors.passwordMismatch).toBeTruthy()
      expect(errors.failed).toBeTruthy()
    },
  )
})

describe('password reset rate limit behavior', () => {
  it('limits repeated reset requests by email', () => {
    const key = 'password-reset:email:user@example.com'

    expect(checkRateLimit({ key, limit: 1, windowMs: 60_000 }).allowed).toBe(
      true,
    )
    expect(checkRateLimit({ key, limit: 1, windowMs: 60_000 }).allowed).toBe(
      false,
    )
  })
})
