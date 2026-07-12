import { afterEach, describe, expect, it } from 'vitest'
import { getAppUrl, getDatabaseUrl } from '@/lib/env'

const originalEnv = process.env

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('environment foundation', () => {
  it('throws for missing required database configuration', () => {
    process.env = { ...originalEnv, DATABASE_URL: '' }

    expect(() => getDatabaseUrl()).toThrow(
      'Missing required environment variable: DATABASE_URL',
    )
  })

  it('falls back to localhost for the application URL in development', () => {
    process.env = {
      ...originalEnv,
      BETTER_AUTH_URL: '',
      NEXT_PUBLIC_APP_URL: '',
      VERCEL_URL: '',
      VERCEL_PROJECT_PRODUCTION_URL: '',
    }

    expect(getAppUrl()).toBe('http://localhost:3000')
  })
})
