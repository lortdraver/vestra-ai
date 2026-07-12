import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

const provider = process.env.WEATHER_PROVIDER
const baseUrl = process.env.WEATHER_API_BASE_URL?.replace(/\/$/, '')
const timeoutMs = Number(process.env.WEATHER_REQUEST_TIMEOUT_MS ?? 7000)
const location = process.env.WEATHER_DIAGNOSTIC_LOCATION ?? 'Baku'

function safeUrl(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    url.search = ''
    return url.toString()
  } catch {
    return 'configured-url'
  }
}

function diagnosticError(status) {
  if (status === 400 || status === 404) return 'weather_invalid_location'
  if (status === 429) return 'weather_rate_limited'
  if (status === 408) return 'weather_timeout'
  if (status === 401 || status === 403) return 'weather_credentials_missing'
  return 'weather_provider_unavailable'
}

async function main() {
  const summary = {
    provider: provider ?? null,
    hasApiKey: Boolean(process.env.WEATHER_API_KEY),
    hasBaseUrl: Boolean(baseUrl),
    timeoutMs,
    requestUrl: baseUrl ? safeUrl(`${baseUrl}/forecast`) : null,
  }

  if (provider === 'mock') {
    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: process.env.NODE_ENV !== 'production',
          message:
            process.env.NODE_ENV === 'production'
              ? 'Mock weather is blocked in production.'
              : 'Mock weather is enabled for local development.',
        },
        null,
        2,
      ),
    )
    return
  }

  if (provider !== 'api' || !process.env.WEATHER_API_KEY || !baseUrl) {
    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: false,
          error: 'weather_credentials_missing',
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  const url = new URL(`${baseUrl}/forecast`)
  url.searchParams.set('q', location)
  url.searchParams.set('units', 'metric')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const startedAt = performance.now()
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WEATHER_API_KEY}` },
      signal: controller.signal,
    })
    const body = response.ok ? null : (await response.text()).slice(0, 500)

    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: response.ok,
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
          error: response.ok ? null : diagnosticError(response.status),
          message: body,
        },
        null,
        2,
      ),
    )
    if (!response.ok) process.exitCode = 1
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: false,
          error:
            error instanceof DOMException && error.name === 'AbortError'
              ? 'weather_timeout'
              : 'weather_provider_unavailable',
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
  }
}

await main()
