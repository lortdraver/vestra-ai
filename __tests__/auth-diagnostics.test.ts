import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getLocalizedAuthErrorMessage } from '@/lib/auth-diagnostics/messages'
import {
  canonicalizeAuthErrorCode,
  extractAuthErrorDetails,
} from '@/lib/auth-diagnostics/shared'
import { getAuthOriginDiagnostics } from '@/lib/auth-origin'
import { dictionaries } from '@/lib/i18n/dictionaries'

const originalEnv = process.env
const diagnoseAuthUserSource = readFileSync(
  join(process.cwd(), 'scripts/diagnose-auth-user.mjs'),
  'utf8',
)

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    BETTER_AUTH_URL: 'http://localhost:3000',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    BETTER_AUTH_TRUSTED_ORIGINS: '',
  }
  vi.restoreAllMocks()
})

describe('auth diagnostics error extraction', () => {
  it('extracts top-level Better Auth errors', () => {
    const details = extractAuthErrorDetails({
      status: 401,
      code: 'INVALID_EMAIL_OR_PASSWORD',
      message: 'Invalid email or password',
      statusText: 'Unauthorized',
    })

    expect(details).toEqual({
      status: 401,
      code: 'INVALID_EMAIL_OR_PASSWORD',
      message: 'Invalid email or password',
      statusText: 'Unauthorized',
      location: 'top-level',
      isTopLevelError: true,
      isNestedBetterFetchError: false,
    })
  })

  it('extracts nested BetterFetch errors', () => {
    const details = extractAuthErrorDetails({
      status: 403,
      statusText: 'Forbidden',
      error: {
        code: 'INVALID_ORIGIN',
        message: 'Invalid origin',
      },
    })

    expect(details.code).toBe('INVALID_ORIGIN')
    expect(details.message).toBe('Invalid origin')
    expect(details.location).toBe('nested')
    expect(details.isNestedBetterFetchError).toBe(true)
  })

  it('canonicalizes known Better Auth error codes', () => {
    expect(
      canonicalizeAuthErrorCode({
        error: {
          code: 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED',
          message: 'Cross-site navigation login blocked',
        },
      }),
    ).toBe('CROSS_SITE_NAVIGATION_LOGIN_BLOCKED')

    expect(
      canonicalizeAuthErrorCode({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email not verified',
      }),
    ).toBe('EMAIL_NOT_VERIFIED')
  })

  it('maps localized UI messages from canonical errors', () => {
    expect(
      getLocalizedAuthErrorMessage(dictionaries.en, {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      }),
    ).toBe(dictionaries.en.auth.wrongPassword)

    expect(
      getLocalizedAuthErrorMessage(dictionaries.ru, {
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email not verified',
        },
      }),
    ).toBe(dictionaries.ru.auth.emailNotVerified)

    expect(
      getLocalizedAuthErrorMessage(dictionaries.az, {
        error: {
          code: 'INVALID_ORIGIN',
          message: 'Invalid origin',
        },
      }),
    ).toBe(dictionaries.az.auth.genericError)
  })
})

describe('auth origin diagnostics', () => {
  it('shows that production trusts apex vestraapp.uk by default but not www', () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.BETTER_AUTH_URL = 'https://vestraapp.uk'
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.vestraapp.uk'
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = ''

    const diagnostics = getAuthOriginDiagnostics('https://www.vestraapp.uk')

    expect(diagnostics.acceptsApexVestraappUk).toBe(true)
    expect(diagnostics.acceptsWwwVestraappUk).toBe(false)
    expect(diagnostics.requestOriginMatchesTrustedOrigins).toBe(false)
    expect(diagnostics.betterAuthHost).toBe('vestraapp.uk')
    expect(diagnostics.nextPublicAppHost).toBe('www.vestraapp.uk')
  })
})

describe('auth user diagnostic script contract', () => {
  it('uses Better Auth camelCase columns and exposes only password presence', () => {
    expect(diagnoseAuthUserSource).toContain('"emailVerified"')
    expect(diagnoseAuthUserSource).toContain('"providerId"')
    expect(diagnoseAuthUserSource).toContain('"userId"')
    expect(diagnoseAuthUserSource).not.toContain('email_verified')
    expect(diagnoseAuthUserSource).not.toContain('provider_id')
    expect(diagnoseAuthUserSource).not.toContain('user_id')
    expect(diagnoseAuthUserSource).toContain('credentialPasswordPresent')
    expect(diagnoseAuthUserSource).not.toContain('passwordHash')
  })
})
