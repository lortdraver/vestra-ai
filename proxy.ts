import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, securityLimits } from '@/lib/security/rate-limit'

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || 'anonymous'
  return `${ip}:${request.nextUrl.pathname}`
}

function limitRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const key = getClientKey(request)

  if (pathname.startsWith('/api/auth')) {
    return checkRateLimit({ key: `auth:${key}`, ...securityLimits.auth })
  }

  if (pathname.startsWith('/api/stylist')) {
    return checkRateLimit({ key: `ai:${key}`, ...securityLimits.ai })
  }

  if (pathname.startsWith('/api/wardrobe/items')) {
    return checkRateLimit({ key: `upload:${key}`, ...securityLimits.upload })
  }

  if (pathname.startsWith('/dashboard/admin')) {
    return checkRateLimit({ key: `admin:${key}`, limit: 120, windowMs: 60_000 })
  }

  return { allowed: true, remaining: 1, resetAt: Date.now() }
}

export function proxy(request: NextRequest) {
  const result = limitRequest(request)

  if (result.allowed) {
    return NextResponse.next()
  }

  const response = request.nextUrl.pathname.startsWith('/api/')
    ? NextResponse.json(
        { error: 'rate_limited', resetAt: result.resetAt },
        { status: 429 },
      )
    : NextResponse.redirect(new URL('/dashboard', request.url))

  response.headers.set('Retry-After', '60')
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
