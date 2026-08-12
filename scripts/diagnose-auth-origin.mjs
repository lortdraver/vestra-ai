import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    const envPath = resolve(process.cwd(), filename)
    if (!existsSync(envPath)) continue

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2]
      }
    }
  }
}

function getArg(name) {
  const prefix = `${name}=`
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
}

function normalizeOrigin(value) {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function normalizeHost(value) {
  if (!value) return null

  try {
    return new URL(value).host
  } catch {
    return null
  }
}

function parseConfiguredTrustedOrigins(
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

function getProductionAppOrigins() {
  return [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter(Boolean)
    .filter((origin) => {
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

function getTrustedOrigins() {
  return Array.from(
    new Set(
      process.env.NODE_ENV === 'production'
        ? [...getProductionAppOrigins(), ...parseConfiguredTrustedOrigins()]
        : [
            normalizeOrigin(process.env.BETTER_AUTH_URL) ??
              'http://localhost:3000',
            ...(process.env.NEXT_PUBLIC_APP_URL
              ? [new URL(process.env.NEXT_PUBLIC_APP_URL).origin]
              : []),
            ...parseConfiguredTrustedOrigins(),
          ].filter(Boolean),
    ),
  )
}

loadEnv()

const requestedOrigin = normalizeOrigin(getArg('--origin'))
const trustedOrigins = getTrustedOrigins()

console.log(
  JSON.stringify(
    {
      environment: process.env.NODE_ENV ?? 'development',
      betterAuthUrl: normalizeOrigin(process.env.BETTER_AUTH_URL),
      betterAuthHost: normalizeHost(process.env.BETTER_AUTH_URL),
      nextPublicAppUrl: normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
      nextPublicAppHost: normalizeHost(process.env.NEXT_PUBLIC_APP_URL),
      trustedOriginsRaw: process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '',
      trustedOrigins,
      requestedOrigin,
      requestOriginMatchesTrustedOrigins: requestedOrigin
        ? trustedOrigins.includes(requestedOrigin)
        : false,
      acceptsApexVestraappUk: trustedOrigins.includes('https://vestraapp.uk'),
      acceptsWwwVestraappUk: trustedOrigins.includes(
        'https://www.vestraapp.uk',
      ),
    },
    null,
    2,
  ),
)
