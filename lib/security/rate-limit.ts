type RateLimitBucket = {
  count: number
  resetAt: number
}

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
}

const buckets = new Map<string, RateLimitBucket>()

export function checkRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: {
  key: string
  limit: number
  windowMs: number
  now?: number
}): RateLimitResult {
  const existing = buckets.get(key)
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs }

  bucket.count += 1
  buckets.set(key, bucket)

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(limit - bucket.count, 0),
    resetAt: new Date(bucket.resetAt),
  }
}

export function resetRateLimitBuckets() {
  buckets.clear()
}

export const securityLimits = {
  auth: { limit: 10, windowMs: 60_000 },
  ai: { limit: 30, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 60_000 },
} as const
