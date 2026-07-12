const requiredServerEnv = ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const

type RequiredServerEnv = (typeof requiredServerEnv)[number]

export function getEnv(name: RequiredServerEnv): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function getDatabaseUrl(): string {
  return getEnv('DATABASE_URL')
}

export function getBetterAuthSecret(): string {
  return getEnv('BETTER_AUTH_SECRET')
}

export function getAppUrl(): string {
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ]

  return (
    candidates.find((candidate) => Boolean(candidate)) ??
    'http://localhost:3000'
  )
}

export function validateServerEnv(): void {
  for (const name of requiredServerEnv) {
    getEnv(name)
  }
}
