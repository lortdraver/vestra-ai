import { describe, expect, it } from 'vitest'
import { createAccountToken, hashAccountToken } from '@/lib/account'
import {
  canAccessAdmin,
  canModerate,
  hasRole,
  normalizeRole,
} from '@/lib/roles'
import {
  checkRateLimit,
  resetRateLimitBuckets,
} from '@/lib/security/rate-limit'

describe('role helpers', () => {
  it('normalizes unknown roles to user', () => {
    expect(normalizeRole('admin')).toBe('admin')
    expect(normalizeRole('unexpected')).toBe('user')
    expect(normalizeRole(null)).toBe('user')
  })

  it('checks hierarchical permissions', () => {
    expect(hasRole('admin', 'moderator')).toBe(true)
    expect(canModerate('moderator')).toBe(true)
    expect(canAccessAdmin('user')).toBe(false)
  })
})

describe('rate limiting', () => {
  it('blocks requests after the configured limit', () => {
    resetRateLimitBuckets()

    expect(
      checkRateLimit({ key: 'auth:test', limit: 2, windowMs: 1000 }).allowed,
    ).toBe(true)
    expect(
      checkRateLimit({ key: 'auth:test', limit: 2, windowMs: 1000 }).allowed,
    ).toBe(true)
    expect(
      checkRateLimit({ key: 'auth:test', limit: 2, windowMs: 1000 }).allowed,
    ).toBe(false)
  })
})

describe('account recovery tokens', () => {
  it('hashes tokens consistently and sets expiry', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const token = createAccountToken({ expiresInMinutes: 30, now })

    expect(token.token.length).toBeGreaterThan(40)
    expect(token.tokenHash).toBe(hashAccountToken(token.token))
    expect(token.expiresAt.toISOString()).toBe('2026-01-01T00:30:00.000Z')
  })
})
