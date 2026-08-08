import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAccountEmailTemplate } from '@/lib/account/email-templates'
import {
  AccountEmailProviderError,
  ManualAccountEmailProvider,
  ResendAccountEmailProvider,
} from '@/lib/account/email-provider'
import {
  createEmailNotVerifiedPayload,
  EMAIL_NOT_VERIFIED_CODE,
  getEmailVerificationCallbackPath,
  isSafeVerificationCallbackPath,
  normalizeVerificationCallbackPath,
  sanitizeBetterAuthVerificationUrl,
} from '@/lib/email-verification-links'
import {
  checkRateLimit,
  resetRateLimitBuckets,
} from '@/lib/security/rate-limit'

const originalEnv = process.env

beforeEach(() => {
  process.env = { ...originalEnv, NEXT_PUBLIC_APP_URL: 'https://vestra.test' }
  resetRateLimitBuckets()
  vi.restoreAllMocks()
})

describe('email verification links', () => {
  it('uses an allowlisted callback path', () => {
    expect(getEmailVerificationCallbackPath()).toBe(
      '/verify-email?status=success',
    )
    expect(isSafeVerificationCallbackPath('/verify-email?status=success')).toBe(
      true,
    )
    expect(isSafeVerificationCallbackPath('/dashboard')).toBe(true)
    expect(isSafeVerificationCallbackPath('https://evil.test/dashboard')).toBe(
      false,
    )
  })

  it('normalizes unsafe callbacks to the verification success page', () => {
    expect(normalizeVerificationCallbackPath('https://evil.test/steal')).toBe(
      '/verify-email?status=success',
    )
  })

  it('rebuilds Better Auth verification URLs from configured app URL', () => {
    const safe = sanitizeBetterAuthVerificationUrl(
      'https://attacker.test/api/auth/verify-email?token=secret-token&callbackURL=https://evil.test',
    )
    const parsed = new URL(safe)

    expect(parsed.origin).toBe('https://vestra.test')
    expect(parsed.pathname).toBe('/api/auth/verify-email')
    expect(parsed.searchParams.get('token')).toBe('secret-token')
    expect(parsed.searchParams.get('callbackURL')).toBe(
      '/verify-email?status=success',
    )
  })
})

describe('email verification copy', () => {
  it.each([
    ['az', 'Vestra e-poçtunuzu təsdiqləyin'],
    ['en', 'Verify your Vestra email'],
    ['ru', 'Подтвердите e-mail Vestra'],
  ] as const)(
    'builds localized verification email for %s',
    (locale, subject) => {
      const template = buildAccountEmailTemplate({
        kind: 'email_verification',
        locale,
        actionUrl: 'https://vestra.test/api/auth/verify-email?token=redacted',
      })

      expect(template.subject).toBe(subject)
      expect(template.text).toContain('https://vestra.test')
      expect(template.html).toContain('href=')
    },
  )

  it('creates a stable unverified API payload', () => {
    expect(createEmailNotVerifiedPayload()).toEqual({
      error: EMAIL_NOT_VERIFIED_CODE,
      code: EMAIL_NOT_VERIFIED_CODE,
      message: 'Email verification is required for this action.',
    })
  })
})

describe('email delivery provider behavior', () => {
  const resendInput = {
    to: 'user@example.com',
    kind: 'email_verification' as const,
    locale: 'en',
    subject: 'Verify',
    text: 'Verify',
    html: '<p>Verify</p>',
  }

  it('manual provider does not log full token-bearing URLs', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    await new ManualAccountEmailProvider().send({
      to: 'user@example.com',
      kind: 'email_verification',
      locale: 'en',
      subject: 'Verify',
      text: 'Verify',
      html: '<p>Verify</p>',
      actionUrl: 'https://vestra.test/api/auth/verify-email?token=secret-token',
    })

    expect(info).toHaveBeenCalledWith(
      'Account email queued for manual delivery',
      expect.objectContaining({
        actionPath: '/api/auth/verify-email',
      }),
    )
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret-token')
  })

  it('resend provider uses Bearer auth only on the server request', async () => {
    process.env.RESEND_API_KEY = 'resend-secret'
    process.env.EMAIL_FROM = 'Vestra <noreply@vestra.test>'
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))

    await new ResendAccountEmailProvider().send(resendInput)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer resend-secret',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('maps missing RESEND_API_KEY to not configured', async () => {
    process.env.EMAIL_FROM = 'Vestra <noreply@vestra.test>'
    await expect(
      new ResendAccountEmailProvider().send(resendInput),
    ).rejects.toMatchObject({
      code: 'email_provider_not_configured',
    })
  })

  it.each([
    [401, 'invalid_api_key', 'Invalid API key', 'email_provider_unauthorized'],
    [
      403,
      'validation_error',
      'The sender domain is not verified.',
      'email_sender_not_verified',
    ],
    [
      422,
      'validation_error',
      'Invalid from address.',
      'email_provider_rejected',
    ],
    [
      429,
      'rate_limit_exceeded',
      'Too many requests.',
      'email_provider_rate_limited',
    ],
  ] as const)(
    'maps Resend %s %s to %s',
    async (status, providerCode, message, expectedCode) => {
      process.env.RESEND_API_KEY = 'resend-secret'
      process.env.EMAIL_FROM = 'Vestra <noreply@vestra.test>'
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json(
          {
            name: providerCode,
            message,
          },
          { status },
        ),
      )

      await expect(
        new ResendAccountEmailProvider().send(resendInput),
      ).rejects.toMatchObject({
        code: expectedCode,
        diagnostics: expect.objectContaining({
          httpStatus: status,
          providerErrorCode: providerCode,
          senderDomain: 'vestra.test',
        }),
      })
    },
  )

  it('maps provider timeout to email_provider_timeout', async () => {
    process.env.RESEND_API_KEY = 'resend-secret'
    process.env.EMAIL_FROM = 'Vestra <noreply@vestra.test>'
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('Aborted', 'AbortError'),
    )

    await expect(
      new ResendAccountEmailProvider().send(resendInput),
    ).rejects.toMatchObject({
      code: 'email_provider_timeout',
      diagnostics: expect.objectContaining({
        providerErrorCode: 'timeout',
      }),
    })
  })

  it('exposes typed delivery failures for network errors', async () => {
    process.env.RESEND_API_KEY = 'resend-secret'
    process.env.EMAIL_FROM = 'Vestra <noreply@vestra.test>'
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    try {
      await new ResendAccountEmailProvider().send(resendInput)
      throw new Error('expected send to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(AccountEmailProviderError)
      expect(error).toMatchObject({ code: 'email_delivery_failed' })
    }
  })
})

describe('resend cooldown behavior', () => {
  it('rate limits repeated resend attempts', () => {
    expect(
      checkRateLimit({
        key: 'email-verification:user:1',
        limit: 1,
        windowMs: 60_000,
      }).allowed,
    ).toBe(true)
    expect(
      checkRateLimit({
        key: 'email-verification:user:1',
        limit: 1,
        windowMs: 60_000,
      }).allowed,
    ).toBe(false)
  })
})
