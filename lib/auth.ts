import { betterAuth } from 'better-auth'
import { networkInterfaces } from 'node:os'
import { pool } from '@/lib/db'
import { getAppUrl, getBetterAuthSecret } from '@/lib/env'

const appUrl = getAppUrl()

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

  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return [...localNetworkOrigins, ...configuredOrigins]
}

const trustedOrigins = Array.from(
  new Set([
    appUrl,
    ...(process.env.NEXT_PUBLIC_APP_URL
      ? [process.env.NEXT_PUBLIC_APP_URL]
      : []),
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    ...getDevelopmentLanOrigins(),
  ]),
)

export const auth = betterAuth({
  database: pool,
  secret: getBetterAuthSecret(),
  baseURL: appUrl,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
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
