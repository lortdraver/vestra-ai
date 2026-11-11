import { sql } from 'drizzle-orm'
import { checkRateLimit, type RateLimitResult } from './rate-limit'

export type RateLimitStore = 'memory' | 'postgres'

export function resolveRateLimitStore(): RateLimitStore {
  const configured = process.env.RATE_LIMIT_STORE?.trim()
  if (configured === 'memory' || configured === 'postgres') return configured
  return process.env.NODE_ENV === 'production' ? 'postgres' : 'memory'
}

let warnedUnavailable = false

/**
 * Fixed-window counter shared by every instance. One atomic upsert per
 * request; the window resets in place once `resetAt` has passed.
 *
 * Fails open: if the store is unreachable (or migration 0017 has not been
 * applied yet) the request is allowed and a single warning is logged, so a
 * database hiccup never takes the whole site down.
 */
export async function consumeRateLimit(input: {
  key: string
  limit: number
  windowMs: number
}): Promise<RateLimitResult> {
  if (resolveRateLimitStore() === 'memory') {
    return checkRateLimit(input)
  }

  try {
    const { db } = await import('@/lib/db')
    const intervalMs = Math.max(1, Math.round(input.windowMs))
    const result = await db.execute<{ count: number; resetAt: Date }>(sql`
      insert into "rate_limit_bucket" ("key", "count", "resetAt")
      values (${input.key}, 1, now() + (${intervalMs} * interval '1 millisecond'))
      on conflict ("key") do update set
        "count" = case when "rate_limit_bucket"."resetAt" <= now()
          then 1 else "rate_limit_bucket"."count" + 1 end,
        "resetAt" = case when "rate_limit_bucket"."resetAt" <= now()
          then now() + (${intervalMs} * interval '1 millisecond')
          else "rate_limit_bucket"."resetAt" end
      returning "count", "resetAt"
    `)
    const row = result.rows[0]
    const count = Number(row?.count ?? 1)

    // Opportunistic cleanup of long-expired buckets (~1% of requests).
    if (Math.random() < 0.01) {
      void db
        .execute(
          sql`delete from "rate_limit_bucket" where "resetAt" < now() - interval '1 hour'`,
        )
        .catch(() => undefined)
    }

    return {
      allowed: count <= input.limit,
      limit: input.limit,
      remaining: Math.max(input.limit - count, 0),
      resetAt: new Date(row?.resetAt ?? Date.now() + input.windowMs),
    }
  } catch (error) {
    if (!warnedUnavailable) {
      warnedUnavailable = true
      console.warn('[rate-limit] STORE_UNAVAILABLE_FAILING_OPEN', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        code:
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : null,
      })
    }
    return {
      allowed: true,
      limit: input.limit,
      remaining: input.limit,
      resetAt: new Date(Date.now() + input.windowMs),
    }
  }
}
