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

function completionsUrl(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions')
    ? trimmed
    : `${trimmed}/chat/completions`
}

async function readOpenRouterMessage(response) {
  const text = await response.text().catch(() => '')
  if (!text) return ''

  try {
    const data = JSON.parse(text)
    return data?.error?.message ?? data?.error?.code ?? ''
  } catch {
    return text.slice(0, 240)
  }
}

async function runDiagnostic({ label, requestUrl, headers, model, messages }) {
  const startedAt = performance.now()
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages,
    }),
  })
  const durationMs = Math.round(performance.now() - startedAt)

  const message = response.ok ? 'ok' : await readOpenRouterMessage(response)
  console.log(
    JSON.stringify(
      {
        label,
        success: response.ok,
        status: response.status,
        message,
        durationMs,
      },
      null,
      2,
    ),
  )
}

loadEnv()

const apiKey = process.env.AI_API_KEY
const baseUrl = process.env.AI_API_BASE_URL
const model = process.env.AI_MODEL_ID
const openRouterReferer =
  process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:3000'

if (!apiKey || !baseUrl || !model) {
  console.error(
    JSON.stringify(
      {
        success: false,
        status: null,
        message:
          'Missing AI_API_KEY, AI_API_BASE_URL, or AI_MODEL_ID. No request was sent.',
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

const requestUrl = completionsUrl(baseUrl)
const headers = {
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': openRouterReferer,
  'X-OpenRouter-Title': 'Vestra',
}

console.log(
  JSON.stringify(
    {
      requestUrl,
      model,
      referer: openRouterReferer,
      title: 'Vestra',
    },
    null,
    2,
  ),
)

await runDiagnostic({
  label: 'text-only',
  requestUrl,
  headers,
  model,
  messages: [
    {
      role: 'user',
      content:
        'Return JSON only: {"ok":true,"message":"text diagnostic passed"}',
    },
  ],
})

await runDiagnostic({
  label: 'image',
  requestUrl,
  headers,
  model,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Return JSON only: {"ok":true,"message":"image diagnostic passed"}',
        },
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
          },
        },
      ],
    },
  ],
})
