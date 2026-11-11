import { afterEach, describe, expect, it, vi } from 'vitest'

const execute = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ db: { execute } }))

import {
  consumeRateLimit,
  resolveRateLimitStore,
} from '@/lib/security/rate-limit-store'
import { resetRateLimitBuckets } from '@/lib/security/rate-limit'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  execute.mockReset()
  resetRateLimitBuckets()
})

describe('rate limit store', () => {
  it('defaults to postgres in production and memory elsewhere', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(resolveRateLimitStore()).toBe('postgres')
    vi.stubEnv('NODE_ENV', 'development')
    expect(resolveRateLimitStore()).toBe('memory')
    vi.stubEnv('RATE_LIMIT_STORE', 'postgres')
    expect(resolveRateLimitStore()).toBe('postgres')
  })

  it('blocks once the shared counter exceeds the limit', async () => {
    vi.stubEnv('RATE_LIMIT_STORE', 'postgres')
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const resetAt = new Date(Date.now() + 60_000)
    execute.mockResolvedValueOnce({ rows: [{ count: 10, resetAt }] })
    execute.mockResolvedValueOnce({ rows: [{ count: 11, resetAt }] })

    const input = { key: 'auth:ip:1.1.1.1', limit: 10, windowMs: 60_000 }
    expect((await consumeRateLimit(input)).allowed).toBe(true)
    expect((await consumeRateLimit(input)).allowed).toBe(false)
  })

  it('fails open when the store is unavailable', async () => {
    vi.stubEnv('RATE_LIMIT_STORE', 'postgres')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    execute.mockRejectedValue(
      Object.assign(new Error('relation missing'), { code: '42P01' }),
    )

    const result = await consumeRateLimit({
      key: 'k',
      limit: 1,
      windowMs: 1000,
    })
    expect(result.allowed).toBe(true)
  })

  it('uses in-process buckets in memory mode', async () => {
    vi.stubEnv('RATE_LIMIT_STORE', 'memory')
    const input = { key: 'mem', limit: 1, windowMs: 60_000 }
    expect((await consumeRateLimit(input)).allowed).toBe(true)
    expect((await consumeRateLimit(input)).allowed).toBe(false)
    expect(execute).not.toHaveBeenCalled()
  })
})
