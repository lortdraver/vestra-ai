import { networkInterfaces } from 'node:os'
import { getAppUrl } from '@/lib/env'

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function normalizeHost(value: string | null | undefined) {
  if (!value) return null

  try {
    return new URL(value).host
  } catch {
    return null
  }
}

export function parseConfiguredTrustedOrigins(
  raw = process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '',
) {
  return raw
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
    .map((origin) => new URL(origin).origin)
}

function getDevelopmentOrigins(appUrl: string) {
  const appUrlValue = new URL(appUrl)
  const port = appUrlValue.port ? `:${appUrlValue.port}` : ''
  return [`http://localhost${port}`, `http://127.0.0.1${port}`]
}

function getDevelopmentLanOrigins(appUrl: string) {
  if (process.env.NODE_ENV !== 'development') {
    return []
  }

  const appUrlValue = new URL(appUrl)
  const protocol = appUrlValue.protocol
  const port = appUrlValue.port ? `:${appUrlValue.port}` : ''

  return Object.values(networkInterfaces())
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
}

function getProductionAppOrigins() {
  return [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter((origin): origin is string => {
      if (!origin) return false

      try {
        const url = new URL(origin)
        return (
          url.protocol === 'https:' && url.origin === 'https://vestraapp.uk'
        )
      } catch {
        return false
      }
    })
    .map((origin) => new URL(origin).origin)
}

export function getAuthTrustedOrigins(appUrl = getAppUrl()) {
  return Array.from(
    new Set(
      process.env.NODE_ENV === 'production'
        ? [...getProductionAppOrigins(), ...parseConfiguredTrustedOrigins()]
        : [
            new URL(appUrl).origin,
            ...(process.env.NEXT_PUBLIC_APP_URL
              ? [new URL(process.env.NEXT_PUBLIC_APP_URL).origin]
              : []),
            ...getDevelopmentOrigins(appUrl),
            ...getDevelopmentLanOrigins(appUrl),
            ...parseConfiguredTrustedOrigins(),
          ],
    ),
  )
}

export function getAuthOriginDiagnostics(input?: string | null) {
  const requestOrigin = normalizeOrigin(input)
  const trustedOrigins = getAuthTrustedOrigins()

  return {
    requestOrigin,
    trustedOrigins,
    requestOriginMatchesTrustedOrigins: requestOrigin
      ? trustedOrigins.includes(requestOrigin)
      : false,
    betterAuthUrl: normalizeOrigin(process.env.BETTER_AUTH_URL),
    betterAuthHost: normalizeHost(process.env.BETTER_AUTH_URL),
    nextPublicAppUrl: normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
    nextPublicAppHost: normalizeHost(process.env.NEXT_PUBLIC_APP_URL),
    trustedOriginsRaw: process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '',
    acceptsApexVestraappUk: trustedOrigins.includes('https://vestraapp.uk'),
    acceptsWwwVestraappUk: trustedOrigins.includes('https://www.vestraapp.uk'),
  }
}
