import {
  stylistBatchResultSchema,
  stylistInsufficientWardrobeResultSchema,
  stylistOutfitSchema,
  stylistResultSchema,
  type StylistBatchResult,
  type StylistCandidate,
  type StylistOutfit,
  type StylistRequest,
  type StylistResult,
  type StylistWardrobeItem,
} from './types'
import {
  findMissingRequiredCategories,
  normalizeStylistCategory,
  requiredCoreCategories,
  resolveStylistOutfitRole,
} from './wardrobe'
import { scoreStylistCandidate } from './scoring'
import type { StylistResolvedPreferenceSignals } from './preferences'
import type { WeatherSuitabilitySignal } from '@/lib/weather'

export type StylistValidationIssue = {
  path: string[]
  code: string
  message: string
}

export type StylistCandidateScoreBreakdown = {
  completeness: number
  occasionMatch: number
  subtypeCompatibility: number
  formalityConsistency: number
  weatherSeason: number
  colorCompatibility: number
  styleConsistency: number
  preferenceMatch: number
  duplicatePenalty: number
}

export class StylistValidationError extends Error {
  constructor(
    message: string,
    readonly issues: StylistValidationIssue[] = [],
  ) {
    super(message)
    this.name = 'StylistValidationError'
  }
}

function toValidationIssues(
  issues: Array<{ path: PropertyKey[]; code: string; message: string }>,
): StylistValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.map((part) => String(part)),
    code: issue.code,
    message: issue.message,
  }))
}

function logValidationIssues(message: string, issues: unknown) {
  if (process.env.NODE_ENV !== 'development') return
  console.warn(message, { issues })
}

function logRoleResolutionDiagnostics(
  diagnostics: Array<{
    providerRole: string
    normalizedProviderRole: string
    wardrobeCategory: string | null
    wardrobeSubcategory: string | null
    resolvedRole: string
    resolutionSource: string
  }>,
) {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return
  console.warn('[stylist-generate] role resolution', { items: diagnostics })
}

function itemSet(candidate: StylistCandidate) {
  return new Set(candidate.items.map((item) => item.wardrobeItemId))
}

export function getCandidateOverlap(
  left: StylistCandidate,
  right: StylistCandidate,
) {
  const leftIds = itemSet(left)
  const rightIds = itemSet(right)
  const shared = [...leftIds].filter((id) => rightIds.has(id)).length
  return shared / Math.max(leftIds.size, rightIds.size, 1)
}

export function filterDiverseCandidates(candidates: StylistCandidate[]) {
  const accepted: StylistCandidate[] = []

  for (const candidate of candidates) {
    const hasExactDuplicate = accepted.some((entry) => {
      const entryIds = [...itemSet(entry)].sort().join(',')
      const candidateIds = [...itemSet(candidate)].sort().join(',')
      return entryIds === candidateIds
    })
    if (hasExactDuplicate) continue

    const tooSimilar = accepted.some(
      (entry) =>
        getCandidateOverlap(entry, candidate) >= 0.85 &&
        entry.styleDirection === candidate.styleDirection,
    )
    if (tooSimilar) continue

    accepted.push(candidate)
  }

  return accepted
}

function getResolvedItemRoleMap(
  outfit: StylistOutfit,
  wardrobeItems: StylistWardrobeItem[],
) {
  const wardrobeById = new Map(wardrobeItems.map((item) => [item.id, item]))
  const roleDiagnostics = outfit.items.map((item) => {
    const wardrobeItem = wardrobeById.get(item.wardrobeItemId)
    const resolution = resolveStylistOutfitRole({
      providerRole: item.role,
      wardrobeCategory: wardrobeItem?.role ?? wardrobeItem?.category,
      wardrobeSubcategory: wardrobeItem?.subtype ?? wardrobeItem?.clothingType,
      wardrobeRole: wardrobeItem?.role,
      wardrobeSubtype: wardrobeItem?.subtype,
    })

    return {
      item,
      wardrobeItem,
      resolution,
      diagnostics: {
        providerRole: item.role,
        normalizedProviderRole: normalizeStylistCategory(item.role),
        wardrobeCategory: wardrobeItem?.role ?? wardrobeItem?.category ?? null,
        wardrobeSubcategory:
          wardrobeItem?.subtype ?? wardrobeItem?.clothingType ?? null,
        resolvedRole: resolution.role,
        resolutionSource: resolution.source,
      },
    }
  })

  logRoleResolutionDiagnostics(
    roleDiagnostics.map((entry) => entry.diagnostics),
  )

  return roleDiagnostics
}

export function validateStylistOutfit(
  output: unknown,
  wardrobeItems: StylistWardrobeItem[],
  options?: {
    requiredCategories?: string[]
    lockedItemIds?: string[]
    request?: StylistRequest
    acceptedCandidates?: StylistCandidate[]
    preferenceSignals?: StylistResolvedPreferenceSignals | null
    weatherSignals?: WeatherSuitabilitySignal[]
  },
) {
  const parsed = stylistOutfitSchema.safeParse(output)
  if (!parsed.success) {
    logValidationIssues(
      '[dev] Stylist outfit validation failed',
      parsed.error.issues,
    )
    throw new StylistValidationError(
      'invalid_stylist_outfit',
      toValidationIssues(parsed.error.issues),
    )
  }

  const outfit = parsed.data
  const wardrobeById = new Map(wardrobeItems.map((item) => [item.id, item]))
  const allowedIds = new Set(wardrobeById.keys())
  const selectedIds = outfit.items.map((item) => item.wardrobeItemId)
  const hallucinatedIds = selectedIds.filter((id) => !allowedIds.has(id))
  const duplicateIds = selectedIds.filter(
    (id, index) => selectedIds.indexOf(id) !== index,
  )

  if (hallucinatedIds.length > 0) {
    throw new StylistValidationError(
      `hallucinated_items:${hallucinatedIds.join(',')}`,
    )
  }

  if (duplicateIds.length > 0) {
    throw new StylistValidationError(
      `duplicate_items:${duplicateIds.join(',')}`,
    )
  }

  const roleDiagnostics = getResolvedItemRoleMap(outfit, wardrobeItems)
  const unresolvedRoles = roleDiagnostics
    .filter((entry) => entry.resolution.role === 'unresolved')
    .map((entry) => entry.item.role)

  if (unresolvedRoles.length > 0) {
    throw new StylistValidationError(
      `unsupported_roles:${unresolvedRoles.join(',')}`,
    )
  }

  const resolvedOutfit: StylistOutfit = {
    ...outfit,
    items: outfit.items.map((item, index) => ({
      ...item,
      role: roleDiagnostics[index]?.resolution.role ?? item.role,
    })),
  }

  const selectedItems = roleDiagnostics
    .map((entry) =>
      entry.wardrobeItem
        ? {
            ...entry.wardrobeItem,
            role: entry.resolution.role,
            category: entry.resolution.role,
          }
        : null,
    )
    .filter((item): item is StylistWardrobeItem => Boolean(item))

  const missingLockedIds = (options?.lockedItemIds ?? []).filter(
    (id) => !selectedIds.includes(id),
  )
  if (missingLockedIds.length > 0) {
    throw new StylistValidationError(
      `missing_locked_items:${missingLockedIds.join(',')}`,
    )
  }

  const requiredCategories = options?.requiredCategories ?? [
    ...requiredCoreCategories,
  ]
  const missingRequiredCategories = findMissingRequiredCategories(
    selectedItems,
    requiredCategories,
  )

  if (missingRequiredCategories.length > 0) {
    throw new StylistValidationError(
      `incomplete_outfit:${missingRequiredCategories.join(',')}`,
    )
  }

  const scoredCandidate = scoreStylistCandidate({
    candidate: resolvedOutfit,
    selectedItems,
    request: options?.request,
    preferenceSignals: options?.preferenceSignals,
    weatherSignals: options?.weatherSignals,
    acceptedCandidates: options?.acceptedCandidates,
  })
  const minimumScore = requiredCategories.length === 0 ? 35 : 50
  if (
    scoredCandidate.candidateScore < minimumScore ||
    scoredCandidate.rejectionReasons.length > 0
  ) {
    throw new StylistValidationError(
      scoredCandidate.rejectionReasons[0] ??
        `candidate_score_too_low:${scoredCandidate.candidateScore}`,
    )
  }

  for (const alternative of outfit.alternativeSuggestions) {
    const invalidAlternativeIds = alternative.itemIds.filter(
      (id) => !allowedIds.has(id),
    )
    if (invalidAlternativeIds.length > 0) {
      throw new StylistValidationError(
        `hallucinated_alternative_items:${invalidAlternativeIds.join(',')}`,
      )
    }
  }

  return {
    ...resolvedOutfit,
    candidateScore: scoredCandidate.candidateScore,
    scoreBreakdown: scoredCandidate.scoreBreakdown,
  } satisfies StylistOutfit
}

export function validateStylistResult(
  output: unknown,
  wardrobeItems: StylistWardrobeItem[],
  options?: {
    requiredCategories?: string[]
    lockedItemIds?: string[]
    request?: StylistRequest
    acceptedCandidates?: StylistCandidate[]
    preferenceSignals?: StylistResolvedPreferenceSignals | null
    weatherSignals?: WeatherSuitabilitySignal[]
  },
): StylistResult {
  const batchParsed = stylistBatchResultSchema.safeParse(output)
  if (batchParsed.success && batchParsed.data.status === 'success') {
    return {
      status: 'success',
      outfit: validateStylistOutfit(
        batchParsed.data.candidates[0],
        wardrobeItems,
        options,
      ),
    }
  }

  const parsed = stylistResultSchema.safeParse(output)
  if (!parsed.success) {
    logValidationIssues(
      '[dev] Stylist result validation failed',
      parsed.error.issues,
    )
    throw new StylistValidationError(
      'invalid_stylist_result',
      toValidationIssues(parsed.error.issues),
    )
  }

  if (parsed.data.status === 'insufficient_wardrobe') {
    return stylistInsufficientWardrobeResultSchema.parse(parsed.data)
  }

  return {
    status: 'success',
    outfit: validateStylistOutfit(parsed.data.outfit, wardrobeItems, options),
  }
}

export function validateStylistBatchResult(
  output: unknown,
  wardrobeItems: StylistWardrobeItem[],
  options?: {
    requiredCategories?: string[]
    lockedItemIds?: string[]
    request?: StylistRequest
    preferenceSignals?: StylistResolvedPreferenceSignals | null
    weatherSignals?: WeatherSuitabilitySignal[]
  },
): StylistBatchResult {
  const parsed = stylistBatchResultSchema.safeParse(output)
  if (!parsed.success) {
    logValidationIssues(
      '[dev] Stylist batch result validation failed',
      parsed.error.issues,
    )
    throw new StylistValidationError(
      'invalid_stylist_batch_result',
      toValidationIssues(parsed.error.issues),
    )
  }

  if (parsed.data.status !== 'success') return parsed.data

  const initiallyValidCandidates: StylistCandidate[] = []
  let firstCandidateError: StylistValidationError | null = null

  for (const candidate of parsed.data.candidates) {
    try {
      initiallyValidCandidates.push(
        validateStylistOutfit(candidate, wardrobeItems, options),
      )
    } catch (error) {
      if (!(error instanceof StylistValidationError)) throw error
      firstCandidateError ??= error
      logValidationIssues('[dev] Stylist candidate rejected before ranking', {
        message: error.message,
      })
    }
  }

  if (initiallyValidCandidates.length === 0) {
    throw (
      firstCandidateError ??
      new StylistValidationError('empty_stylist_candidates')
    )
  }

  const sortedCandidates = [...initiallyValidCandidates].sort(
    (left, right) =>
      (right.candidateScore ?? 0) - (left.candidateScore ?? 0) ||
      right.confidenceScore - left.confidenceScore,
  )
  const rescoredCandidates: StylistCandidate[] = []
  let firstRescoringError: StylistValidationError | null = null

  for (const candidate of sortedCandidates) {
    try {
      rescoredCandidates.push(
        validateStylistOutfit(candidate, wardrobeItems, {
          ...options,
          acceptedCandidates: rescoredCandidates,
        }),
      )
    } catch (error) {
      if (!(error instanceof StylistValidationError)) throw error
      firstRescoringError ??= error
      logValidationIssues(
        '[dev] Stylist candidate rejected after diversity scoring',
        {
          message: error.message,
        },
      )
    }
  }

  const diverseCandidates = filterDiverseCandidates(rescoredCandidates).sort(
    (left, right) => (right.candidateScore ?? 0) - (left.candidateScore ?? 0),
  )

  if (diverseCandidates.length === 0) {
    throw (
      firstRescoringError ??
      firstCandidateError ??
      new StylistValidationError('empty_stylist_candidates')
    )
  }

  return {
    ...parsed.data,
    candidates: diverseCandidates,
    limitedVariety:
      parsed.data.limitedVariety ||
      diverseCandidates.length < parsed.data.candidates.length,
  }
}
