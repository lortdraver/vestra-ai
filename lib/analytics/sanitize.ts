import { z } from 'zod'
import type { AnalyticsProperties } from './events'

const forbiddenKeyPattern =
  /email|password|token|secret|authorization|cookie|prompt|response|notes?|image|photo|base64|storage|private|phone/i
const valueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z
    .array(z.union([z.string().max(120), z.number().finite(), z.boolean()]))
    .max(32),
])

export function sanitizeAnalyticsPath(path: string | null | undefined) {
  if (!path) return null
  try {
    const parsed = new URL(path, 'https://vestra.invalid')
    return `${parsed.pathname}${parsed.search ? '?query' : ''}`.slice(0, 300)
  } catch {
    return path.startsWith('/') ? path.split('?')[0].slice(0, 300) : null
  }
}

export function sanitizeAnalyticsProperties(
  value: Record<string, unknown> | undefined,
) {
  const sanitized: Record<string, unknown> = {}
  const rejectedKeys: string[] = []
  for (const [key, rawValue] of Object.entries(value ?? {})) {
    if (forbiddenKeyPattern.test(key)) {
      rejectedKeys.push(key)
      continue
    }
    const parsed = valueSchema.safeParse(rawValue)
    if (parsed.success) sanitized[key.slice(0, 80)] = parsed.data
  }
  return { properties: sanitized as AnalyticsProperties, rejectedKeys }
}
