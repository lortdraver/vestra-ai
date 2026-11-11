import { NextResponse, type NextRequest } from 'next/server'
import {
  getRateLimitClientKey,
  resolveRateLimitRule,
} from '@/lib/security/rate-limit-policy'
import { consumeRateLimit } from '@/lib/security/rate-limit-store'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const rule = resolveRateLimitRule(request.method, pathname)
  if (!rule) return NextResponse.next()

  const clientKey = getRateLimitClientKey(request.headers, {
    preferSession: rule.preferSession,
  })
  const result = await consumeRateLimit({
    key: `${rule.bucket}:${clientKey}`,
    limit: rule.limit,
    windowMs: rule.windowMs,
  })

  if (result.allowed) {
    return NextResponse.next()
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
  )
  const response = pathname.startsWith('/api/')
    ? NextResponse.json(
        { error: 'rate_limited', resetAt: result.resetAt },
        { status: 429 },
      )
    : NextResponse.redirect(new URL('/dashboard', request.url))

  response.headers.set('Retry-After', String(retryAfterSeconds))
  return response
}

export const config = {
  matcher: [
    '/api/auth/:path*',
    '/api/stylist/:path*',
    '/api/wardrobe/items/:path*',
    '/dashboard/admin/:path*',
  ],
}
