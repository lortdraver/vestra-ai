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

const provider = process.env.BACKGROUND_REMOVAL_PROVIDER ?? 'mock'
const endpoint = process.env.BACKGROUND_REMOVAL_API_URL
const timeoutMs = Number(
  process.env.BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS ?? 15000,
)
const modelId =
  process.env.BACKGROUND_REMOVAL_MODEL_ID ?? 'background-removal-v1'
const size = process.env.BACKGROUND_REMOVAL_SIZE ?? 'auto'

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

async function main() {
  const summary = {
    provider,
    hasApiKey: Boolean(process.env.BACKGROUND_REMOVAL_API_KEY),
    hasEndpoint: Boolean(endpoint),
    endpoint: safeUrl(endpoint),
    modelId,
    size,
    timeoutMs,
  }

  if (provider === 'mock') {
    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: process.env.NODE_ENV !== 'production',
          message:
            process.env.NODE_ENV === 'production'
              ? 'Mock background removal is blocked in production.'
              : 'Mock background removal returns the original uploaded image unchanged and is local-only.',
        },
        null,
        2,
      ),
    )
    return
  }

  if (!['api', 'removebg'].includes(provider)) {
    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: false,
          error: 'background_removal_provider_unsupported',
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  if (!process.env.BACKGROUND_REMOVAL_API_KEY) {
    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: false,
          error: 'background_removal_credentials_missing',
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  const pngBytes = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNk+M+ABzAxMIjGoQMAWnMCCXy6X6QAAAAASUVORK5CYII=',
    ),
    (char) => char.charCodeAt(0),
  )
  const body = new FormData()
  if (provider === 'removebg') {
    body.set(
      'image_file',
      new Blob([pngBytes], { type: 'image/png' }),
      'diagnostic.png',
    )
    body.set('size', size)
  } else {
    if (!endpoint) {
      console.log(
        JSON.stringify(
          {
            ...summary,
            ok: false,
            error: 'background_removal_credentials_missing',
          },
          null,
          2,
        ),
      )
      process.exitCode = 1
      return
    }
    body.set(
      'image',
      new Blob([pngBytes], { type: 'image/png' }),
      'diagnostic.png',
    )
    body.set('mode', 'single_item')
    body.set('modelId', modelId)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const requestEndpoint =
    provider === 'removebg'
      ? endpoint || 'https://api.remove.bg/v1.0/removebg'
      : endpoint

  try {
    const startedAt = performance.now()
    const response = await fetch(requestEndpoint, {
      method: 'POST',
      headers:
        provider === 'removebg'
          ? {
              'X-Api-Key': process.env.BACKGROUND_REMOVAL_API_KEY,
              Accept: 'image/png',
            }
          : {
              Authorization: `Bearer ${process.env.BACKGROUND_REMOVAL_API_KEY}`,
              Accept: 'image/png, application/json',
            },
      body,
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type')
    const outputSize = response.ok
      ? (await response.clone().arrayBuffer()).byteLength
      : null
    const message = response.ok ? null : (await response.text()).slice(0, 500)

    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: response.ok,
          status: response.status,
          contentType,
          outputSize,
          durationMs: Math.round(performance.now() - startedAt),
          message,
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
              ? 'background_removal_timeout'
              : 'background_removal_provider_unavailable',
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
