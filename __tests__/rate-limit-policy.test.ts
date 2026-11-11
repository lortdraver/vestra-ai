import { describe, expect, it } from 'vitest'
import {
  getRateLimitClientKey,
  resolveRateLimitRule,
} from '@/lib/security/rate-limit-policy'

describe('rate limit rules', () => {
  it('strictly limits auth writes such as sign-in', () => {
    expect(
      resolveRateLimitRule('POST', '/api/auth/sign-in/email'),
    ).toMatchObject({ bucket: 'auth', limit: 10 })
  })

  it('does not apply the strict auth bucket to session reads', () => {
    expect(resolveRateLimitRule('GET', '/api/auth/get-session')).toMatchObject({
      bucket: 'auth-read',
    })
    expect(
      resolveRateLimitRule('GET', '/api/auth/get-session')?.limit,
    ).toBeGreaterThan(10)
  })

  it('limits AI stylist and wardrobe writes separately from reads', () => {
    expect(resolveRateLimitRule('POST', '/api/stylist/generate')?.bucket).toBe(
      'ai',
    )
    expect(
      resolveRateLimitRule('POST', '/api/wardrobe/items/abc/analysis')?.bucket,
    ).toBe('upload')
    expect(resolveRateLimitRule('GET', '/api/wardrobe/items')?.bucket).toBe(
      'read',
    )
  })

  it('ignores unmatched routes', () => {
    expect(resolveRateLimitRule('GET', '/api/health')).toBeNull()
  })
})

describe('rate limit client key', () => {
  it('keys authenticated requests on a hash of the session cookie', () => {
    const headers = new Headers({
      cookie: 'other=1; better-auth.session_token=tok.sig',
      'x-forwarded-for': '1.1.1.1',
    })
    const key = getRateLimitClientKey(headers, { preferSession: true })

    expect(key.startsWith('s:')).toBe(true)
    expect(key).not.toContain('tok.sig')
    expect(
      getRateLimitClientKey(
        new Headers({ cookie: '__Secure-better-auth.session_token=tok.sig' }),
        { preferSession: true },
      ),
    ).toBe(key)
  })

  it('uses the platform client IP rather than a spoofable forwarded chain', () => {
    const headers = new Headers({
      'x-real-ip': '2.2.2.2',
      'x-forwarded-for': '9.9.9.9, 2.2.2.2',
    })
    expect(getRateLimitClientKey(headers, { preferSession: false })).toBe(
      'ip:2.2.2.2',
    )
  })

  it('falls back to the first forwarded address, then anonymous', () => {
    expect(
      getRateLimitClientKey(
        new Headers({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }),
        {
          preferSession: false,
        },
      ),
    ).toBe('ip:3.3.3.3')
    expect(getRateLimitClientKey(new Headers(), { preferSession: false })).toBe(
      'ip:anonymous',
    )
  })

  it('keys sign-in by IP even when a session cookie exists', () => {
    const headers = new Headers({
      cookie: 'better-auth.session_token=tok.sig',
      'x-real-ip': '5.5.5.5',
    })
    expect(getRateLimitClientKey(headers, { preferSession: false })).toBe(
      'ip:5.5.5.5',
    )
  })
})
