import {
  stylistInsufficientWardrobeResultSchema,
  stylistBatchResultSchema,
  stylistOutfitSchema,
  stylistResultSchema,
  type StylistBatchResult,
  type StylistCandidate,
  type StylistOutfit,
  type StylistResult,
  type StylistWardrobeItem,
} from './types'
import {
  findMissingRequiredCategories,
  normalizeStylistCategory,
  requiredCoreCategories,
  resolveStylistOutfitRole,
} from './wardrobe'

export type StylistValidationIssue = {
  path: string[]
  code: string
  message: string
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

export function validateStylistOutfit(
  output: unknown,
  wardrobeItems: StylistWardrobeItem[],
  options?: { requiredCategories?: string[]; lockedItemIds?: string[] },
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

  const roleDiagnostics = outfit.items.map((item) => {
    const wardrobeItem = wardrobeById.get(item.wardrobeItemId)
    const resolution = resolveStylistOutfitRole({
      providerRole: item.role,
      wardrobeCategory: wardrobeItem?.category,
      wardrobeSubcategory: wardrobeItem?.clothingType,
    })

    return {
      item,
      wardrobeItem,
      resolution,
      diagnostics: {
        providerRole: item.role,
        normalizedProviderRole: normalizeStylistCategory(item.role),
        wardrobeCategory: wardrobeItem?.category ?? null,
        wardrobeSubcategory: wardrobeItem?.clothingType ?? null,
        resolvedRole: resolution.role,
        resolutionSource: resolution.source,
      },
    }
  })
  logRoleResolutionDiagnostics(
    roleDiagnostics.map((entry) => entry.diagnostics),
  )

  const unsupportedRoles = roleDiagnostics
    .filter((entry) => entry.resolution.role === 'other')
    .map((entry) => entry.item.role)

  if (unsupportedRoles.length > 0) {
    throw new StylistValidationError(
      `unsupported_roles:${unsupportedRoles.join(',')}`,
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

  for (const alternative of outfit.alternativeSuggestions) {
    const invalidAlternativeIds = alternative.itemIds.filter(
      (id) => !allowedIds.has(id),
    )
    if (invalidAlternativeIds.length > 0) {
      throw new Error(
        `hallucinated_alternative_items:${invalidAlternativeIds.join(',')}`,
      )
    }
  }

  return resolvedOutfit satisfies StylistOutfit
}

export function validateStylistResult(
  output: unknown,
  wardrobeItems: StylistWardrobeItem[],
  options?: { requiredCategories?: string[]; lockedItemIds?: string[] },
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
  options?: { requiredCategories?: string[]; lockedItemIds?: string[] },
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
    throw new Error('empty_stylist_candidates')
  }

  return {
    ...parsed.data,
    candidates: diverseCandidates,
    limitedVariety:
      parsed.data.limitedVariety ||
      diverseCandidates.length < parsed.data.candidates.length,
  }
}
