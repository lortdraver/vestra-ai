import { z } from 'zod'
import { normalizeStylistCategory } from './wardrobe'

export type StylistProviderResponseMetadata = {
  httpStatus: number
  modelId: string
  responseFormatMode: 'json_schema' | 'json_object'
  requestCount: number
  retryCount: number
  fallbackUsed: boolean
}

export type StylistProviderEnvelope = {
  output: unknown
  metadata: StylistProviderResponseMetadata
}

const providerItemSchema = z.object({
  wardrobeItemId: z.string().uuid(),
  role: z.string().trim().min(1).max(80),
})

const providerCandidateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1200),
  styleDirection: z.string().trim().max(80).default(''),
  occasion: z.string().trim().max(120).nullable().default(null),
  season: z.string().trim().max(80).nullable().default(null),
  formality: z.string().trim().max(80).nullable().default(null),
  confidence: z.union([z.number(), z.string()]).default(0.7),
  items: z.array(providerItemSchema).min(1).max(8),
})

export const providerBatchSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    candidates: z.array(providerCandidateSchema).min(1).max(5),
  }),
  z.object({
    status: z.literal('insufficient_wardrobe'),
    message: z.string().trim().min(1).max(1000),
    missingCategories: z.array(z.string().trim().min(1).max(80)).max(8),
    availableCategories: z.array(z.string().trim().min(1).max(80)).max(16),
  }),
  z.object({
    status: z.literal('generation_failed'),
    message: z.string().trim().min(1).max(1000),
    retryable: z.boolean().default(true),
  }),
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function parseFiniteConfidence(value: unknown) {
  const numberValue = typeof value === 'string' ? Number(value) : value
  return typeof numberValue === 'number' && Number.isFinite(numberValue)
    ? Math.min(Math.max(numberValue, 0), 1)
    : 0.7
}

export function stripJsonCodeFence(value: string) {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced?.[1]?.trim() ?? trimmed
}

export function parseProviderJson(value: unknown) {
  if (typeof value !== 'string') return value
  return JSON.parse(stripJsonCodeFence(value)) as unknown
}

function normalizeProviderItem(value: unknown) {
  if (!isRecord(value)) return value

  return {
    wardrobeItemId: value.wardrobeItemId,
    role: normalizeStylistCategory(String(value.role ?? '')),
    explanation:
      typeof value.explanation === 'string' && value.explanation.trim()
        ? value.explanation
        : 'Selected from your wardrobe for this outfit.',
  }
}

function normalizeProviderCandidate(value: unknown) {
  if (!isRecord(value)) return value

  const description =
    typeof value.description === 'string' && value.description.trim()
      ? value.description
      : typeof value.overallExplanation === 'string'
        ? value.overallExplanation
        : ''

  return {
    title: value.title,
    occasion:
      typeof value.occasion === 'string'
        ? value.occasion
        : (value.occasion ?? ''),
    styleDirection:
      typeof value.styleDirection === 'string' ? value.styleDirection : '',
    seasonLabel: typeof value.season === 'string' ? value.season : '',
    formalityLabel: typeof value.formality === 'string' ? value.formality : '',
    items: Array.isArray(value.items)
      ? value.items.map(normalizeProviderItem)
      : value.items,
    overallExplanation: description,
    confidenceScore: parseFiniteConfidence(value.confidence),
    alternativeSuggestions: [],
    missingItems: [],
  }
}

function normalizeLegacySingleOutfit(value: Record<string, unknown>) {
  if (value.status !== 'success' || !isRecord(value.outfit)) return value

  return {
    status: 'success',
    candidates: [normalizeProviderCandidate(value.outfit)],
  }
}

export function normalizeStylistProviderOutput(value: unknown) {
  const parsed = parseProviderJson(value)
  if (!isRecord(parsed)) return parsed

  if (parsed.status === 'success' && isRecord(parsed.outfit)) {
    return normalizeLegacySingleOutfit(parsed)
  }

  if (
    parsed.status === 'success' &&
    !Array.isArray(parsed.candidates) &&
    isRecord(parsed.candidate)
  ) {
    return {
      status: 'success',
      candidates: [normalizeProviderCandidate(parsed.candidate)],
    }
  }

  if (parsed.status === 'success' && Array.isArray(parsed.candidates)) {
    return {
      ...parsed,
      candidates: parsed.candidates.map(normalizeProviderCandidate),
    }
  }

  if (parsed.status === 'insufficient_wardrobe') {
    return {
      status: 'insufficient_wardrobe',
      message: parsed.message,
      missingCategories: Array.isArray(parsed.missingCategories)
        ? parsed.missingCategories.map((category) =>
            normalizeStylistCategory(String(category)),
          )
        : [],
      availableCategories: Array.isArray(parsed.availableCategories)
        ? parsed.availableCategories.map((category) =>
            normalizeStylistCategory(String(category)),
          )
        : [],
    }
  }

  return parsed
}

export function getProviderTopLevelKeys(value: unknown) {
  const normalized =
    typeof value === 'string' ? parseProviderJson(value) : value
  return isRecord(normalized) ? Object.keys(normalized).sort() : []
}

export function getProviderCandidateCount(value: unknown) {
  const normalized = normalizeStylistProviderOutput(value)
  if (!isRecord(normalized) || normalized.status !== 'success') return null
  return Array.isArray(normalized.candidates) ? normalized.candidates.length : 0
}

export function getSanitizedProviderPreview(value: unknown, maxLength = 700) {
  if (process.env.NODE_ENV !== 'development') return undefined

  const normalized = normalizeStylistProviderOutput(value)
  const preview = JSON.stringify(normalized, (_key, child) => {
    if (
      ['notes', 'preferenceContext', 'request', 'wardrobeItems'].includes(_key)
    ) {
      return '[redacted]'
    }
    return child
  })

  return preview.length > maxLength
    ? `${preview.slice(0, maxLength)}...`
    : preview
}
