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
  getRequiredCategoriesForStylistRequest,
  normalizeStylistCategory,
  requiredCoreCategories,
  resolveStylistOutfitRole,
} from './wardrobe'

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

function buildScoreBreakdown(
  outfit: StylistOutfit,
  selectedItems: StylistWardrobeItem[],
  request?: StylistRequest,
): StylistCandidateScoreBreakdown {
  const breakdown: StylistCandidateScoreBreakdown = {
    completeness: 0,
    occasionMatch: 0,
    subtypeCompatibility: 0,
    formalityConsistency: 0,
    weatherSeason: 0,
    colorCompatibility: 0,
    styleConsistency: 0,
    preferenceMatch: 0,
    duplicatePenalty: 0,
  }

  const requiredCategories = request
    ? getRequiredCategoriesForStylistRequest(request)
    : [...requiredCoreCategories]
  const selectedRoles = new Set(selectedItems.map((item) => item.role))
  const hasAllRequired = requiredCategories.every((role) =>
    selectedRoles.has(role),
  )
  breakdown.completeness = hasAllRequired ? 20 : 6

  const subtypes = selectedItems.map((item) => item.subtype)
  const styleTags = selectedItems.flatMap((item) => item.styleTags)
  const formalityValues = selectedItems.map((item) => item.formality)
  const colorFamilies = selectedItems.flatMap((item) => item.colorFamilies)
  const message =
    `${request?.message ?? ''} ${request?.quickRequest ?? ''}`.toLowerCase()

  if (
    request?.quickRequest === 'wedding' ||
    request?.quickRequest === 'business' ||
    /\bformal|wedding|business|office|smart\b/.test(message)
  ) {
    breakdown.occasionMatch += 10
    if (
      subtypes.some((value) =>
        ['shorts', 'joggers', 'sweatpants'].includes(value),
      )
    ) {
      breakdown.subtypeCompatibility -= 14
    } else {
      breakdown.subtypeCompatibility += 10
    }
    if (
      subtypes.some((value) =>
        ['shirt', 'trousers', 'blazer', 'dress_shoes', 'loafers'].includes(
          value,
        ),
      )
    ) {
      breakdown.occasionMatch += 8
    }
  }

  if (
    request?.quickRequest === 'sport' ||
    /\bsport|gym|training|workout\b/.test(message)
  ) {
    if (
      subtypes.some((value) =>
        ['shorts', 'joggers', 'sweatpants'].includes(value),
      )
    ) {
      breakdown.subtypeCompatibility += 10
    } else {
      breakdown.subtypeCompatibility -= 10
    }
    if (subtypes.includes('sneakers')) {
      breakdown.occasionMatch += 10
    } else {
      breakdown.occasionMatch -= 8
    }
  }

  if (request?.quickRequest === 'university') {
    if (
      subtypes.some((value) =>
        ['t_shirt', 'polo', 'shirt', 'hoodie'].includes(value),
      )
    ) {
      breakdown.occasionMatch += 8
    }
    if (
      subtypes.some((value) =>
        ['jeans', 'chinos', 'shorts', 'joggers'].includes(value),
      )
    ) {
      breakdown.subtypeCompatibility += 8
    }
    if (subtypes.includes('sneakers') || subtypes.includes('loafers')) {
      breakdown.occasionMatch += 4
    }
  }

  const uniqueFormality = new Set(formalityValues)
  breakdown.formalityConsistency =
    uniqueFormality.size <= 2
      ? 10
      : Math.max(-10, 12 - uniqueFormality.size * 6)

  if (request?.weatherContext) {
    if (request.weatherContext.temperatureC >= 28) {
      if (
        subtypes.some((value) =>
          ['shorts', 'tank_top', 'polo', 't_shirt'].includes(value),
        )
      ) {
        breakdown.weatherSeason += 10
      }
      if (
        subtypes.some((value) =>
          ['coat', 'hoodie', 'sweater', 'boots'].includes(value),
        )
      ) {
        breakdown.weatherSeason -= 10
      }
    }
    if (request.weatherContext.temperatureC <= 8) {
      if (
        subtypes.some((value) =>
          ['hoodie', 'sweater', 'coat', 'jacket', 'boots'].includes(value),
        )
      ) {
        breakdown.weatherSeason += 10
      }
      if (
        subtypes.some((value) =>
          ['shorts', 'sandals', 'tank_top'].includes(value),
        )
      ) {
        breakdown.weatherSeason -= 10
      }
    }
  }

  const neutralCount = colorFamilies.filter((value) =>
    ['black', 'white', 'gray', 'navy', 'beige', 'brown'].includes(value),
  ).length
  const brightCount = colorFamilies.filter((value) =>
    ['red', 'pink', 'yellow', 'orange', 'purple', 'green'].includes(value),
  ).length
  breakdown.colorCompatibility =
    neutralCount >= 2 ? 10 : brightCount >= 3 ? -6 : 4

  const uniqueStyles = new Set(styleTags)
  breakdown.styleConsistency = uniqueStyles.size <= 3 ? 8 : 3

  return breakdown
}

function totalCandidateScore(breakdown: StylistCandidateScoreBreakdown) {
  return (
    breakdown.completeness +
    breakdown.occasionMatch +
    breakdown.subtypeCompatibility +
    breakdown.formalityConsistency +
    breakdown.weatherSeason +
    breakdown.colorCompatibility +
    breakdown.styleConsistency +
    breakdown.preferenceMatch +
    breakdown.duplicatePenalty
  )
}

export function validateStylistOutfit(
  output: unknown,
  wardrobeItems: StylistWardrobeItem[],
  options?: {
    requiredCategories?: string[]
    lockedItemIds?: string[]
    request?: StylistRequest
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

  const scoreBreakdown = buildScoreBreakdown(
    resolvedOutfit,
    selectedItems,
    options?.request,
  )
  const candidateScore = totalCandidateScore(scoreBreakdown)
  const minimumScore = requiredCategories.length === 0 ? 25 : 32
  if (candidateScore < minimumScore) {
    throw new StylistValidationError(
      `candidate_score_too_low:${candidateScore}`,
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
    candidateScore,
    scoreBreakdown,
  } satisfies StylistOutfit
}

export function validateStylistResult(
  output: unknown,
  wardrobeItems: StylistWardrobeItem[],
  options?: {
    requiredCategories?: string[]
    lockedItemIds?: string[]
    request?: StylistRequest
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

  const validatedCandidates = parsed.data.candidates.map((candidate) =>
    validateStylistOutfit(candidate, wardrobeItems, options),
  )
  const diverseCandidates = filterDiverseCandidates(validatedCandidates)

  if (diverseCandidates.length === 0) {
    throw new StylistValidationError('empty_stylist_candidates')
  }

  return {
    ...parsed.data,
    candidates: diverseCandidates,
    limitedVariety:
      parsed.data.limitedVariety ||
      diverseCandidates.length < parsed.data.candidates.length,
  }
}
