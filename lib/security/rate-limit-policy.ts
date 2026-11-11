import { createHash } from 'node:crypto'

export type RateLimitRule = {
  bucket: 'auth' | 'auth-read' | 'ai' | 'upload' | 'read' | 'admin'
  limit: number
  windowMs: number
  /** Key on the session when one exists; otherwise on client IP. */
  preferSession: boolean
}

const MINUTE = 60_000
const isRead = (method: string) => method === 'GET' || method === 'HEAD'

export function resolveRateLimitRule(
  method: string,
  pathname: string,
): RateLimitRule | null {
  if (pathname.startsWith('/api/auth')) {
    // Session reads (useSession polling) must not share the strict bucket
    // with credential endpoints, or users behind one NAT lock each other out.
    return isRead(method)
      ? {
          bucket: 'auth-read',
          limit: 300,
          windowMs: MINUTE,
          preferSession: true,
        }
      : { bucket: 'auth', limit: 10, windowMs: MINUTE, preferSession: false }
  }

  if (pathname.startsWith('/api/stylist')) {
    return isRead(method)
      ? { bucket: 'read', limit: 240, windowMs: MINUTE, preferSession: true }
      : { bucket: 'ai', limit: 30, windowMs: MINUTE, preferSession: true }
  }

  if (pathname.startsWith('/api/wardrobe/items')) {
    return isRead(method)
      ? { bucket: 'read', limit: 240, windowMs: MINUTE, preferSession: true }
      : { bucket: 'upload', limit: 20, windowMs: MINUTE, preferSession: true }
  }

  if (pathname.startsWith('/dashboard/admin')) {
    return {
      bucket: 'admin',
      limit: 120,
      windowMs: MINUTE,
      preferSession: true,
    }
  }

  return null
}

const sessionCookieNames = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
]

function readSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const name = part.slice(0, index).trim()
    if (sessionCookieNames.includes(name)) {
      const value = part.slice(index + 1).trim()
      return value || null
    }
  }
  return null
}

function getClientIp(headers: Headers) {
  // Platform-set headers first: they are overwritten by the edge (Vercel,
  // most proxies), unlike a client-supplied x-forwarded-for chain.
  const platformIp =
    headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    headers.get('cf-connecting-ip')?.trim()
  if (platformIp) return platformIp

  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous'
}

export function getRateLimitClientKey(
  headers: Headers,
  options: { preferSession: boolean },
) {
  if (options.preferSession) {
    const token = readSessionCookie(headers.get('cookie'))
    if (token) {
      const hash = createHash('sha256').update(token).digest('hex').slice(0, 32)
      return `s:${hash}`
    }
  }

  return `ip:${getClientIp(headers)}`
}
