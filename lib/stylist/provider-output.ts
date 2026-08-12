import { z } from 'zod'
import {
  normalizeWardrobeRole,
  unresolvedWardrobeRole,
} from '@/lib/wardrobe/taxonomy'
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

export type StylistProviderDetectedShape =
  'candidates' | 'items_only' | 'outfit' | 'single_candidate' | 'unknown'

export type StylistProviderNormalizationSummary = {
  topLevelKeys: string[]
  originalStatus: string | null
  normalizedStatus:
    'success' | 'insufficient_wardrobe' | 'generation_failed' | null
  detectedProviderShape: StylistProviderDetectedShape
  originalCandidateCount: number | null
  normalizedCandidateCount: number | null
  normalizationApplied: boolean
  normalizationReason: string | null
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

function normalizeProviderRole(value: unknown) {
  return (
    normalizeWardrobeRole(String(value ?? ''), {
      allowUnresolved: true,
    }) ?? unresolvedWardrobeRole
  )
}

function normalizeProviderItem(value: unknown) {
  if (!isRecord(value)) return value

  const wardrobeItemId = getFirstExistingValue(value, [
    'wardrobeItemId',
    'itemId',
    'id',
  ])
  const explanationValue = getFirstExistingValue(value, [
    'explanation',
    'reasoning',
    'why',
    'note',
    'notes',
  ])
  const roleValue = getFirstExistingValue(value, ['role', 'category'])

  return {
    wardrobeItemId,
    role: normalizeProviderRole(roleValue),
    explanation:
      typeof explanationValue === 'string' && explanationValue.trim()
        ? explanationValue
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
      az: `${itemList} birlikdə seçildi, çünki bu geyimlər sorğunuza uyğun tamamlanmış kombin yaradır.${requestLabel ? ' Sorğunun konteksti nəzərə alındı.' : ''}`,
      en: `${itemList} were selected together because these wardrobe items create a complete outfit for your request.${requestLabel ? ' The request context was considered.' : ''}`,
      ru: `${itemList} выбраны вместе, потому что эти вещи создают завершенный образ под ваш запрос.${requestLabel ? ' Контекст запроса учтен.' : ''}`,
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

function normalizeProviderStatus(
  value: unknown,
): StylistProviderNormalizationSummary['normalizedStatus'] {
  const status = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!status) return null
  if (
    ['success', 'completed', 'complete', 'ok', 'generated'].includes(status)
  ) {
    return 'success'
  }
  if (['insufficient_wardrobe', 'insufficient'].includes(status)) {
    return 'insufficient_wardrobe'
  }
  if (['generation_failed', 'failed'].includes(status)) {
    return 'generation_failed'
  }
  return null
}

function detectProviderShape(
  value: Record<string, unknown>,
): StylistProviderDetectedShape {
  if (Array.isArray(value.candidates)) return 'candidates'
  if (Array.isArray(value.items)) return 'items_only'
  if (
    'outfit' in value &&
    (Array.isArray(value.outfit) || isRecord(value.outfit))
  ) {
    return 'outfit'
  }
  if (
    isRecord(value.candidate) ||
    (Array.isArray(value.items) &&
      ('title' in value ||
        'name' in value ||
        'heading' in value ||
        'confidence' in value))
  ) {
    return 'single_candidate'
  }
  if (
    Array.isArray(value.items) &&
    ('title' in value ||
      'name' in value ||
      'outfitTitle' in value ||
      'heading' in value ||
      'confidence' in value ||
      'notes' in value ||
      'reasoning' in value)
  ) {
    return 'single_candidate'
  }
  return 'unknown'
}

function getOriginalStatus(value: Record<string, unknown>) {
  if (typeof value.status !== 'string') return null
  const trimmed = value.status.trim()
  return trimmed || null
}

function getOriginalCandidateCount(
  value: Record<string, unknown>,
  shape: StylistProviderDetectedShape,
) {
  switch (shape) {
    case 'candidates':
      return Array.isArray(value.candidates) ? value.candidates.length : null
    case 'items_only':
    case 'single_candidate':
      return Array.isArray(value.items) ? 1 : null
    case 'outfit':
      if (Array.isArray(value.outfit)) return 1
      if (isRecord(value.outfit)) return 1
      return null
    default:
      return null
  }
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
  parentValue?: Record<string, unknown>,
) {
  if (!isRecord(value)) return value

  const locale = context?.locale ?? 'en'
  const mergedValue = parentValue ? { ...parentValue, ...value } : value
  const title = recoverTitle(mergedValue, locale)
  let description = recoverExplanation(mergedValue, context)
  if (description.trim().length < 1) {
    description = buildFallbackExplanation(mergedValue, context)
  }

  return {
    title,
    occasion:
      typeof mergedValue.occasion === 'string'
        ? mergedValue.occasion
        : (mergedValue.occasion ?? ''),
    styleDirection:
      typeof mergedValue.styleDirection === 'string'
        ? mergedValue.styleDirection
        : '',
    seasonLabel:
      typeof mergedValue.seasonLabel === 'string'
        ? mergedValue.seasonLabel
        : typeof mergedValue.season === 'string'
          ? mergedValue.season
          : '',
    formalityLabel:
      typeof mergedValue.formalityLabel === 'string'
        ? mergedValue.formalityLabel
        : typeof mergedValue.formality === 'string'
          ? mergedValue.formality
          : '',
    items: Array.isArray(mergedValue.items)
      ? mergedValue.items.map(normalizeProviderItem)
      : mergedValue.items,
    overallExplanation: description,
    confidenceScore: parseFiniteConfidence(
      getFirstExistingValue(mergedValue, ['confidenceScore', 'confidence']),
    ),
    alternativeSuggestions: [],
    missingItems: Array.isArray(mergedValue.optionalMissingItems)
      ? mergedValue.optionalMissingItems
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 8)
      : Array.isArray(mergedValue.missingItems)
        ? mergedValue.missingItems
            .map((item) => String(item).trim())
            .filter(Boolean)
            .slice(0, 8)
        : [],
  }
}

function isSingleCandidateRecord(value: Record<string, unknown>) {
  return (
    Array.isArray(value.items) &&
    ('title' in value ||
      'name' in value ||
      'outfitTitle' in value ||
      'outfit_name' in value ||
      'heading' in value ||
      'confidence' in value ||
      'confidenceScore' in value)
  )
}

function normalizeSuccessShape(
  parsed: Record<string, unknown>,
  context?: StylistProviderNormalizationContext,
) {
  const shape = detectProviderShape(parsed)

  switch (shape) {
    case 'candidates':
      return {
        status: 'success' as const,
        candidates: (parsed.candidates as unknown[]).map((candidate) =>
          normalizeProviderCandidate(candidate, context),
        ),
      }
    case 'items_only':
      return {
        status: 'success' as const,
        candidates: [normalizeProviderCandidate(parsed, context)],
      }
    case 'outfit': {
      if (isRecord(parsed.outfit)) {
        return {
          status: 'success' as const,
          candidates: [
            normalizeProviderCandidate(parsed.outfit, context, parsed),
          ],
        }
      }
      if (Array.isArray(parsed.outfit)) {
        return {
          status: 'success' as const,
          candidates: [
            normalizeProviderCandidate(
              { ...parsed, items: parsed.outfit },
              context,
            ),
          ],
        }
      }
      break
    }
    case 'single_candidate':
      if (isRecord(parsed.candidate)) {
        return {
          status: 'success' as const,
          candidates: [
            normalizeProviderCandidate(parsed.candidate, context, parsed),
          ],
        }
      }
      if (isSingleCandidateRecord(parsed)) {
        return {
          status: 'success' as const,
          candidates: [normalizeProviderCandidate(parsed, context)],
        }
      }
      break
    default:
      break
  }

  return parsed
}

export function normalizeStylistProviderOutput(
  value: unknown,
  context?: StylistProviderNormalizationContext,
) {
  const parsed = parseProviderJson(value)
  if (!isRecord(parsed)) return parsed

  const normalizedStatus = normalizeProviderStatus(parsed.status)

  if (normalizedStatus === 'success') {
    return normalizeSuccessShape({ ...parsed, status: 'success' }, context)
  }

  if (normalizedStatus === 'insufficient_wardrobe') {
    return {
      status: 'insufficient_wardrobe',
      message:
        typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message
          : 'Not enough wardrobe items to build a complete outfit.',
      missingCategories: Array.isArray(parsed.missingCategories)
        ? parsed.missingCategories.map((category) =>
            normalizeProviderRole(String(category)),
          )
        : Array.isArray(parsed.optionalMissingItems)
          ? parsed.optionalMissingItems.map((category) =>
              normalizeProviderRole(String(category)),
            )
          : [],
      availableCategories: Array.isArray(parsed.availableCategories)
        ? parsed.availableCategories.map((category) =>
            normalizeProviderRole(String(category)),
          )
        : [],
    }
  }

  if (normalizedStatus === 'generation_failed') {
    return {
      status: 'generation_failed',
      message:
        typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message
          : 'The provider could not generate a valid outfit.',
      retryable: Boolean(parsed.retryable ?? true),
    }
  }

  if (isSingleCandidateRecord(parsed)) {
    return {
      status: 'success',
      candidates: [normalizeProviderCandidate(parsed, context)],
    }
  }

  return parsed
}

export function getProviderNormalizationSummary(
  value: unknown,
  context?: StylistProviderNormalizationContext,
): StylistProviderNormalizationSummary {
  const parsed = parseProviderJson(value)
  if (!isRecord(parsed)) {
    return {
      topLevelKeys: [],
      originalStatus: null,
      normalizedStatus: null,
      detectedProviderShape: 'unknown',
      originalCandidateCount: null,
      normalizedCandidateCount: null,
      normalizationApplied: false,
      normalizationReason: null,
    }
  }

  const originalStatus = getOriginalStatus(parsed)
  const normalizedStatus = normalizeProviderStatus(parsed.status)
  const detectedProviderShape = detectProviderShape(parsed)
  const originalCandidateCount = getOriginalCandidateCount(
    parsed,
    detectedProviderShape,
  )
  const normalized = normalizeStylistProviderOutput(value, context)
  const normalizedCandidateCount =
    isRecord(normalized) &&
    normalized.status === 'success' &&
    Array.isArray(normalized.candidates)
      ? normalized.candidates.length
      : null
  const normalizationApplied =
    normalizedStatus !== originalStatus ||
    (detectedProviderShape !== 'unknown' &&
      (detectedProviderShape !== 'candidates' || originalStatus !== 'success'))
  let normalizationReason: string | null = null

  if (
    originalStatus &&
    normalizedStatus &&
    originalStatus !== normalizedStatus
  ) {
    normalizationReason = `status:${originalStatus}->${normalizedStatus}`
  } else if (detectedProviderShape === 'items_only') {
    normalizationReason = 'wrapped_top_level_items_as_candidate'
  } else if (detectedProviderShape === 'outfit') {
    normalizationReason = 'converted_outfit_shape_to_candidate_batch'
  } else if (detectedProviderShape === 'single_candidate') {
    normalizationReason = 'wrapped_single_candidate_shape'
  }

  return {
    topLevelKeys: Object.keys(parsed).sort(),
    originalStatus,
    normalizedStatus,
    detectedProviderShape,
    originalCandidateCount,
    normalizedCandidateCount,
    normalizationApplied,
    normalizationReason,
  }
}

export function getProviderCandidateNormalizationDiagnostics(
  value: unknown,
  context?: StylistProviderNormalizationContext,
): StylistProviderCandidateNormalizationDiagnostic[] {
  const parsed = parseProviderJson(value)
  if (!isRecord(parsed)) return []

  const normalizedStatus = normalizeProviderStatus(parsed.status)
  if (normalizedStatus !== 'success' && !isSingleCandidateRecord(parsed)) {
    return []
  }

  const shape = detectProviderShape(parsed)
  const candidates =
    shape === 'candidates' && Array.isArray(parsed.candidates)
      ? parsed.candidates
      : shape === 'items_only'
        ? [parsed]
        : shape === 'outfit'
          ? Array.isArray(parsed.outfit)
            ? [{ ...parsed, items: parsed.outfit }]
            : isRecord(parsed.outfit)
              ? [{ ...parsed, ...parsed.outfit }]
              : []
          : shape === 'single_candidate'
            ? isRecord(parsed.candidate)
              ? [{ ...parsed, ...parsed.candidate }]
              : [parsed]
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
  return getProviderNormalizationSummary(value).normalizedCandidateCount
}

export function getSanitizedProviderPreview(value: unknown, maxLength = 700) {
  if (process.env.NODE_ENV !== 'development') return undefined

  const normalized = normalizeStylistProviderOutput(value)
  const preview = JSON.stringify(normalized)

  return preview.length > maxLength
    ? `${preview.slice(0, maxLength)}...`
    : preview
}
