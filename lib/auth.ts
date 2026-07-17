import { betterAuth } from 'better-auth'
import { networkInterfaces } from 'node:os'
import { buildAccountEmailTemplate } from '@/lib/account/email-templates'
import { getAccountEmailProvider } from '@/lib/account/email-provider'
import { pool } from '@/lib/db'
import { getAppUrl, getBetterAuthSecret } from '@/lib/env'
import { sanitizeBetterAuthVerificationUrl } from '@/lib/email-verification-links'
import {
  localeCookieName,
  normalizeLocale,
  type Locale,
} from '@/lib/i18n/config'

const appUrl = getAppUrl()

function parseTrustedOrigins() {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => {
      if (origin.includes('*')) return false

      try {
        const url = new URL(origin)
        if (process.env.NODE_ENV === 'production') {
          return url.protocol === 'https:'
        }

        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    })
}

function getDevelopmentOrigins() {
  const appUrlValue = new URL(appUrl)
  const port = appUrlValue.port ? `:${appUrlValue.port}` : ''
  return [`http://localhost${port}`, `http://127.0.0.1${port}`]
}

function getDevelopmentLanOrigins() {
  if (process.env.NODE_ENV !== 'development') {
    return []
  }

  const appUrlValue = new URL(appUrl)
  const protocol = appUrlValue.protocol
  const port = appUrlValue.port ? `:${appUrlValue.port}` : ''
  const localNetworkOrigins = Object.values(networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter((networkInterface) => {
      if (networkInterface.family !== 'IPv4' || networkInterface.internal) {
        return false
      }

      return /^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(
        networkInterface.address,
      )
    })
    .map(
      (networkInterface) => `${protocol}//${networkInterface.address}${port}`,
    )

  return localNetworkOrigins
}

function getProductionAppOrigins() {
  return [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
    (origin): origin is string => {
      if (!origin) return false
      try {
        return new URL(origin).protocol === 'https:'
      } catch {
        return false
      }
    },
  )
}

const trustedOrigins = Array.from(
  new Set(
    process.env.NODE_ENV === 'production'
      ? [...getProductionAppOrigins(), ...parseTrustedOrigins()]
      : [
          appUrl,
          ...(process.env.NEXT_PUBLIC_APP_URL
            ? [process.env.NEXT_PUBLIC_APP_URL]
            : []),
          ...getDevelopmentOrigins(),
          ...getDevelopmentLanOrigins(),
          ...parseTrustedOrigins(),
        ],
  ),
)

function getRequestLocale(request?: Request | null): Locale {
  const cookieHeader = request?.headers.get('cookie')
  const cookieLocale = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieName}=`))
    ?.split('=')[1]

  return normalizeLocale(
    cookieLocale ??
      request?.headers.get('accept-language')?.split(',')[0] ??
      undefined,
  )
}

function getEmailVerificationExpiresIn() {
  const parsed = Number(
    process.env.EMAIL_VERIFICATION_EXPIRES_SECONDS ?? 86_400,
  )
  if (!Number.isFinite(parsed)) return 86_400
  return Math.min(Math.max(parsed, 900), 60 * 60 * 24 * 7)
}

export const auth = betterAuth({
  database: pool,
  secret: getBetterAuthSecret(),
  baseURL: appUrl,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: getEmailVerificationExpiresIn(),
    sendVerificationEmail: async ({ user, url }, request) => {
      const safeUrl = sanitizeBetterAuthVerificationUrl(url)
      const locale = getRequestLocale(request)
      const template = buildAccountEmailTemplate({
        kind: 'email_verification',
        locale,
        actionUrl: safeUrl,
      })
      await getAccountEmailProvider().send({
        to: user.email,
        kind: 'email_verification',
        locale,
        actionUrl: safeUrl,
        ...template,
      })
    },
  },
  trustedOrigins,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
