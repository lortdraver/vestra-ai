import { z } from 'zod'
import { normalizeStylistCategory } from './wardrobe'
import type { Locale } from '@/lib/i18n/config'
import type { StylistProviderInput, StylistWardrobeItem } from './types'

export type StylistProviderResponseMetadata = {
  httpStatus: number
  modelId: string
  responseFormatMode: 'json_schema' | 'json_object'
  requestCount: number
  retryCount: number
  fallbackUsed: boolean
  elapsedMs?: number
  timeoutMs?: number
  aborted?: boolean
}

export type StylistProviderEnvelope = {
  output: unknown
  metadata: StylistProviderResponseMetadata
}

export type StylistProviderNormalizationContext = {
  locale?: Locale
  request?: Pick<StylistProviderInput['request'], 'message' | 'quickRequest'>
  wardrobeItems?: StylistWardrobeItem[]
}

export type StylistProviderCandidateNormalizationDiagnostic = {
  candidateIndex: number
  candidateKeys: string[]
  titleOriginalType: string
  titleNormalizedLength: number
  explanationOriginalType: string
  explanationNormalizedLength: number
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

function getValueType(value: unknown) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
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

const titleFallbacks: Record<Locale, string> = {
  az: 'Tövsiyə olunan obraz',
  en: 'Recommended outfit',
  ru: 'Рекомендованный образ',
}

const explanationFallbacks: Record<Locale, string> = {
  az: 'Bu obraz qarderobunuzdakı seçilmiş geyimləri birlikdə istifadə edir və sorğunuza uyğun balanslı kombin yaradır.',
  en: 'This outfit uses the selected items from your wardrobe together to create a balanced look for your request.',
  ru: 'Этот образ сочетает выбранные вещи из вашего гардероба и подходит под ваш запрос.',
}

function firstNonEmptyString(values: unknown[], locale: Locale): string | null {
  for (const value of values) {
    const result = recoverString(value, locale)
    if (result) return result
  }
  return null
}

function recoverString(value: unknown, locale: Locale): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (Array.isArray(value)) {
    return firstNonEmptyString(value, locale)
  }

  if (isRecord(value)) {
    const localized = recoverString(value[locale], locale)
    if (localized) return localized
    return firstNonEmptyString(Object.values(value), locale)
  }

  return null
}

function getFirstExistingValue(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in value) return value[key]
  }
  return undefined
}

function getSelectedItemNames(
  items: unknown,
  wardrobeItems: StylistWardrobeItem[] | undefined,
) {
  if (!Array.isArray(items) || !wardrobeItems?.length) return []

  const wardrobeById = new Map(wardrobeItems.map((item) => [item.id, item]))
  return items
    .map((item) =>
      isRecord(item) && typeof item.wardrobeItemId === 'string'
        ? wardrobeById.get(item.wardrobeItemId)?.name
        : null,
    )
    .filter((name): name is string => Boolean(name?.trim()))
}

function buildFallbackExplanation(
  value: Record<string, unknown>,
  context: StylistProviderNormalizationContext | undefined,
) {
  const locale = context?.locale ?? 'en'
  const itemNames = getSelectedItemNames(value.items, context?.wardrobeItems)
  const requestLabel =
    context?.request?.quickRequest ?? context?.request?.message ?? ''

  if (itemNames.length > 0) {
    const itemList = itemNames.slice(0, 4).join(', ')
    return {
      az: `${itemList} birlikdə seçildi, çünki bu geyimlər qarderobunuzdan uyğun və tamamlanmış kombin yaradır.${requestLabel ? ' Sorğunuz nəzərə alındı.' : ''}`,
      en: `${itemList} were selected together because these wardrobe items create a complete and suitable outfit.${requestLabel ? ' The request context was considered.' : ''}`,
      ru: `${itemList} выбраны вместе, потому что эти вещи из гардероба создают завершенный и подходящий образ.${requestLabel ? ' Контекст запроса учтен.' : ''}`,
    }[locale]
  }

  return explanationFallbacks[locale]
}

function recoverTitle(value: Record<string, unknown>, locale: Locale) {
  const source = getFirstExistingValue(value, [
    'title',
    'name',
    'outfitTitle',
    'outfit_name',
    'heading',
  ])
  return recoverString(source, locale) ?? titleFallbacks[locale]
}

function recoverExplanation(
  value: Record<string, unknown>,
  context: StylistProviderNormalizationContext | undefined,
) {
  const locale = context?.locale ?? 'en'
  const source = getFirstExistingValue(value, [
    'overallExplanation',
    'description',
    'explanation',
    'reasoning',
    'rationale',
    'summary',
    'outfitExplanation',
    'overall_explanation',
  ])
  const recovered = recoverString(source, locale)
  return recovered && recovered.length >= 1
    ? recovered
    : buildFallbackExplanation(value, context)
}

function normalizeProviderCandidate(
  value: unknown,
  context?: StylistProviderNormalizationContext,
) {
  if (!isRecord(value)) return value

  const locale = context?.locale ?? 'en'
  const title = recoverTitle(value, locale)
  let description = recoverExplanation(value, context)
  if (description.trim().length < 1) {
    description = buildFallbackExplanation(value, context)
  }

  return {
    title,
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

function normalizeLegacySingleOutfit(
  value: Record<string, unknown>,
  context?: StylistProviderNormalizationContext,
) {
  if (value.status !== 'success' || !isRecord(value.outfit)) return value

  return {
    status: 'success',
    candidates: [normalizeProviderCandidate(value.outfit, context)],
  }
}

export function normalizeStylistProviderOutput(
  value: unknown,
  context?: StylistProviderNormalizationContext,
) {
  const parsed = parseProviderJson(value)
  if (!isRecord(parsed)) return parsed

  if (parsed.status === 'success' && isRecord(parsed.outfit)) {
    return normalizeLegacySingleOutfit(parsed, context)
  }

  if (
    parsed.status === 'success' &&
    !Array.isArray(parsed.candidates) &&
    isRecord(parsed.candidate)
  ) {
    return {
      status: 'success',
      candidates: [normalizeProviderCandidate(parsed.candidate, context)],
    }
  }

  if (parsed.status === 'success' && Array.isArray(parsed.candidates)) {
    return {
      ...parsed,
      candidates: parsed.candidates.map((candidate) =>
        normalizeProviderCandidate(candidate, context),
      ),
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

export function getProviderCandidateNormalizationDiagnostics(
  value: unknown,
  context?: StylistProviderNormalizationContext,
): StylistProviderCandidateNormalizationDiagnostic[] {
  const parsed = parseProviderJson(value)
  if (!isRecord(parsed) || parsed.status !== 'success') return []

  const candidates = Array.isArray(parsed.candidates)
    ? parsed.candidates
    : isRecord(parsed.candidate)
      ? [parsed.candidate]
      : isRecord(parsed.outfit)
        ? [parsed.outfit]
        : []

  const normalized = normalizeStylistProviderOutput(value, context)
  const normalizedCandidates =
    isRecord(normalized) &&
    normalized.status === 'success' &&
    Array.isArray(normalized.candidates)
      ? normalized.candidates
      : []

  return candidates.map((candidate, candidateIndex) => {
    const candidateRecord = isRecord(candidate) ? candidate : {}
    const normalizedCandidate = normalizedCandidates[candidateIndex]
    const titleSource = getFirstExistingValue(candidateRecord, [
      'title',
      'name',
      'outfitTitle',
      'outfit_name',
      'heading',
    ])
    const explanationSource = getFirstExistingValue(candidateRecord, [
      'overallExplanation',
      'description',
      'explanation',
      'reasoning',
      'rationale',
      'summary',
      'outfitExplanation',
      'overall_explanation',
    ])

    return {
      candidateIndex,
      candidateKeys: Object.keys(candidateRecord).sort(),
      titleOriginalType: getValueType(titleSource),
      titleNormalizedLength:
        isRecord(normalizedCandidate) &&
        typeof normalizedCandidate.title === 'string'
          ? normalizedCandidate.title.length
          : 0,
      explanationOriginalType: getValueType(explanationSource),
      explanationNormalizedLength:
        isRecord(normalizedCandidate) &&
        typeof normalizedCandidate.overallExplanation === 'string'
          ? normalizedCandidate.overallExplanation.length
          : 0,
    }
  })
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
