import { NextResponse, type NextRequest } from 'next/server'
import {
  getRateLimitClientKey,
  resolveRateLimitRule,
} from '@/lib/security/rate-limit-policy'
import { consumeRateLimit } from '@/lib/security/rate-limit-store'

/**
 * The production deployment is also reachable at its *.vercel.app address,
 * where sign-in can never work (auth only trusts the real domain). Send those
 * visitors to the canonical site instead of showing a failing login.
 */
function getCanonicalRedirect(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'production') return null
  const host = request.headers.get('host') ?? ''
  if (!host.endsWith('.vercel.app')) return null
  const canonical =
    process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
  if (!canonical) return null
  try {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      canonical,
    )
    if (target.host === host) return null
    return NextResponse.redirect(target, 308)
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const canonicalRedirect = getCanonicalRedirect(request)
  if (canonicalRedirect) return canonicalRedirect

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
    // Every page and API route (for the canonical-domain redirect), but not
    // static assets.
    '/((?!_next/static|_next/image|favicon|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)',
    '/api/auth/:path*',
    '/api/stylist/:path*',
    '/api/wardrobe/items/:path*',
    '/dashboard/admin/:path*',
  ],
}
