import type { wardrobeItem } from '@/lib/db/schema'
import {
  mergeAnalysisCorrections,
  parseAnalysisCorrections,
  parseClothingAnalysis,
} from '@/lib/ai/analysis-schema'
import {
  getWardrobeColorFamilyLabel,
  getWardrobeFormalityFromLevel,
  normalizeWardrobeColorFamilies,
  normalizeWardrobeFormality,
  normalizeWardrobeRole,
  normalizeWardrobeStyleTags,
  resolveWardrobeTaxonomy,
  unresolvedWardrobeRole,
  unresolvedWardrobeSubtype,
  type WardrobeRole,
} from '@/lib/wardrobe/taxonomy'
import type {
  QuickRequestId,
  StylistRequest,
  StylistWardrobeItem,
} from './types'

type WardrobeRow = typeof wardrobeItem.$inferSelect

type RequestProfile = {
  preferredRoles?: WardrobeRole[]
  preferredTopSubtypes?: string[]
  preferredBottomSubtypes?: string[]
  preferredShoeSubtypes?: string[]
  preferredOuterwearSubtypes?: string[]
  preferredStyles?: string[]
  preferredFormality?: string[]
  avoidSubtypes?: string[]
}

const requestProfiles: Partial<Record<QuickRequestId, RequestProfile>> = {
  university: {
    preferredTopSubtypes: ['t_shirt', 'polo', 'shirt', 'hoodie', 'sweater'],
    preferredBottomSubtypes: ['jeans', 'chinos', 'shorts', 'joggers'],
    preferredShoeSubtypes: ['sneakers', 'loafers'],
    preferredStyles: ['casual', 'relaxed', 'smart_casual'],
    preferredFormality: ['casual', 'smart_casual'],
  },
  work: {
    preferredTopSubtypes: ['shirt', 'polo', 'sweater'],
    preferredBottomSubtypes: ['trousers', 'chinos', 'jeans'],
    preferredShoeSubtypes: ['loafers', 'dress_shoes', 'sneakers'],
    preferredOuterwearSubtypes: ['blazer', 'cardigan'],
    preferredStyles: ['business', 'classic', 'smart_casual'],
    preferredFormality: ['smart_casual', 'business'],
    avoidSubtypes: ['joggers', 'sweatpants'],
  },
  business: {
    preferredTopSubtypes: ['shirt', 'polo'],
    preferredBottomSubtypes: ['trousers', 'chinos'],
    preferredShoeSubtypes: ['dress_shoes', 'loafers'],
    preferredOuterwearSubtypes: ['blazer'],
    preferredStyles: ['business', 'formal', 'classic'],
    preferredFormality: ['business', 'formal'],
    avoidSubtypes: ['shorts', 'joggers', 'sweatpants'],
  },
  wedding: {
    preferredTopSubtypes: ['shirt'],
    preferredBottomSubtypes: ['trousers'],
    preferredShoeSubtypes: ['dress_shoes', 'loafers', 'heels'],
    preferredOuterwearSubtypes: ['blazer'],
    preferredStyles: ['formal', 'classic', 'evening'],
    preferredFormality: ['formal', 'business'],
    avoidSubtypes: ['shorts', 'joggers', 'sneakers'],
  },
  restaurant: {
    preferredTopSubtypes: ['shirt', 'polo', 'sweater'],
    preferredBottomSubtypes: ['trousers', 'chinos', 'jeans'],
    preferredShoeSubtypes: ['loafers', 'dress_shoes', 'sneakers'],
    preferredStyles: ['classic', 'smart_casual', 'evening'],
    preferredFormality: ['smart_casual', 'business'],
  },
  date: {
    preferredTopSubtypes: ['shirt', 'polo', 'sweater'],
    preferredBottomSubtypes: ['trousers', 'chinos', 'jeans'],
    preferredShoeSubtypes: ['loafers', 'sneakers', 'heels'],
    preferredStyles: ['classic', 'casual', 'evening'],
    preferredFormality: ['casual', 'smart_casual'],
  },
  sport: {
    preferredTopSubtypes: ['t_shirt', 'tank_top', 'hoodie'],
    preferredBottomSubtypes: ['shorts', 'joggers', 'sweatpants'],
    preferredShoeSubtypes: ['sneakers'],
    preferredStyles: ['sport'],
    preferredFormality: ['relaxed', 'casual'],
    avoidSubtypes: ['blazer', 'dress_shoes', 'heels'],
  },
  hot_weather: {
    preferredTopSubtypes: ['t_shirt', 'polo', 'tank_top', 'shirt'],
    preferredBottomSubtypes: ['shorts', 'chinos', 'trousers'],
    preferredShoeSubtypes: ['sneakers', 'sandals', 'loafers'],
    avoidSubtypes: ['coat', 'hoodie', 'sweater', 'boots'],
  },
  cold_weather: {
    preferredTopSubtypes: ['hoodie', 'sweater', 'shirt', 'sweatshirt'],
    preferredBottomSubtypes: ['jeans', 'trousers', 'joggers'],
    preferredShoeSubtypes: ['boots', 'sneakers', 'loafers'],
    preferredOuterwearSubtypes: ['jacket', 'coat', 'cardigan', 'blazer'],
  },
  rain: {
    preferredShoeSubtypes: ['boots', 'sneakers'],
    preferredOuterwearSubtypes: ['jacket', 'coat'],
  },
}

export const requiredCoreCategories = ['top', 'bottom', 'shoes'] as const

export function normalizeStylistCategory(category: string, clothingType = '') {
  const normalizedCategory = normalizeWardrobeRole(category, {
    allowUnresolved: false,
  })
  if (normalizedCategory) return normalizedCategory

  const normalizedTypeRole = normalizeWardrobeRole(clothingType, {
    allowUnresolved: false,
  })
  if (normalizedTypeRole) return normalizedTypeRole

  return resolveWardrobeTaxonomy({
    category,
    clothingType,
  }).role
}

export type StylistRoleResolutionSource =
  'wardrobe_role' | 'wardrobe_subtype' | 'provider_role' | 'unresolved'

export type StylistRoleResolution = {
  role: string
  source: StylistRoleResolutionSource
}

export function resolveStylistOutfitRole(input: {
  providerRole?: string
  wardrobeCategory?: string
  wardrobeSubcategory?: string
  wardrobeRole?: string
  wardrobeSubtype?: string
}): StylistRoleResolution {
  const wardrobeRole = normalizeWardrobeRole(input.wardrobeRole, {
    allowUnresolved: false,
  })
  if (wardrobeRole) {
    return { role: wardrobeRole, source: 'wardrobe_role' }
  }

  const resolvedFromWardrobe = resolveWardrobeTaxonomy({
    role: input.wardrobeCategory,
    subtype: input.wardrobeSubcategory,
  })
  if (resolvedFromWardrobe.role !== unresolvedWardrobeRole) {
    return {
      role: resolvedFromWardrobe.role,
      source:
        resolvedFromWardrobe.subtype !== unresolvedWardrobeSubtype
          ? 'wardrobe_subtype'
          : 'wardrobe_role',
    }
  }

  const providerRole = normalizeWardrobeRole(input.providerRole, {
    allowUnresolved: false,
  })
  if (providerRole) {
    return { role: providerRole, source: 'provider_role' }
  }

  return { role: unresolvedWardrobeRole, source: 'unresolved' }
}

function getPreferredProfile(request: StylistRequest) {
  return request.quickRequest
    ? (requestProfiles[request.quickRequest] ?? {})
    : {}
}

function buildPromptContext(request: StylistRequest) {
  return `${request.message} ${request.quickRequest ?? ''} ${request.occasion ?? ''}`.toLowerCase()
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

export function toStylistWardrobeItem(row: WardrobeRow): StylistWardrobeItem {
  const aiAnalysis = row.aiAnalysis
    ? parseClothingAnalysis(row.aiAnalysis)
    : null
  const userCorrections = row.userCorrections
    ? parseAnalysisCorrections(row.userCorrections)
    : null
  const effectiveAnalysis = mergeAnalysisCorrections(
    aiAnalysis,
    userCorrections,
  )
  const taxonomy = resolveWardrobeTaxonomy({
    role:
      effectiveAnalysis?.role ??
      effectiveAnalysis?.detectedCategory ??
      row.category,
    subtype:
      effectiveAnalysis?.subtype ??
      effectiveAnalysis?.detectedClothingType ??
      row.clothingType,
    category: row.category,
    clothingType: row.clothingType,
    analysisRole: aiAnalysis?.role ?? aiAnalysis?.detectedCategory,
    analysisSubtype: aiAnalysis?.subtype ?? aiAnalysis?.detectedClothingType,
  })
  const styleTags =
    effectiveAnalysis?.styleTags?.length || effectiveAnalysis?.style?.length
      ? normalizeWardrobeStyleTags(
          effectiveAnalysis.styleTags ?? effectiveAnalysis.style,
        )
      : normalizeWardrobeStyleTags(row.styles)
  const colorFamilies =
    effectiveAnalysis?.colorFamilies?.length ||
    effectiveAnalysis?.colors?.length
      ? normalizeWardrobeColorFamilies(
          effectiveAnalysis.colorFamilies ?? effectiveAnalysis.colors,
        )
      : normalizeWardrobeColorFamilies(row.colors)
  const formality =
    effectiveAnalysis?.formality ??
    getWardrobeFormalityFromLevel(effectiveAnalysis?.formalityLevel ?? 2)

  return {
    id: row.id,
    name: row.name,
    imageUrl: row.processedImageUrl ?? row.imageUrl,
    notes: row.notes,
    role: taxonomy.role,
    subtype: taxonomy.subtype,
    category: taxonomy.role,
    clothingType: taxonomy.subtype,
    colors:
      effectiveAnalysis?.colors?.length && effectiveAnalysis.colors.length > 0
        ? effectiveAnalysis.colors
        : row.colors,
    colorFamilies,
    seasons:
      effectiveAnalysis?.season?.length && effectiveAnalysis.season.length > 0
        ? effectiveAnalysis.season
        : row.seasons,
    styles: styleTags,
    styleTags,
    formality: normalizeWardrobeFormality(formality) ?? 'casual',
    material: effectiveAnalysis?.material || row.material,
    brand: effectiveAnalysis?.brandGuess || row.brand,
  }
}

export function getStylistWardrobeDiagnostics(rows: WardrobeRow[]) {
  const activeRows = rows.filter((row) => row.imageDeletionStatus === 'active')
  const excludedRows = rows.filter(
    (row) => row.imageDeletionStatus !== 'active',
  )
  const normalizedItems = activeRows.map(toStylistWardrobeItem)
  const categories = countBy(normalizedItems.map((item) => item.role))
  const subtypes = countBy(normalizedItems.map((item) => item.subtype))
  const analysisStatuses = countBy(rows.map((row) => row.analysisStatus))

  return {
    eligibleItemCount: normalizedItems.length,
    categories,
    subtypes,
    analysisStatuses,
    excluded: {
      imageDeletionNotActive: excludedRows.length,
      unresolvedTaxonomy: normalizedItems.filter(
        (item) =>
          item.role === unresolvedWardrobeRole ||
          item.subtype === unresolvedWardrobeSubtype,
      ).length,
    },
  }
}

function scoreItem(item: StylistWardrobeItem, request: StylistRequest) {
  const prompt = buildPromptContext(request)
  const profile = getPreferredProfile(request)
  let score = 0

  if (prompt.includes(item.name.toLowerCase())) score += 4
  if (prompt.includes(item.subtype.toLowerCase())) score += 3
  if (prompt.includes(item.role.toLowerCase())) score += 2
  if (profile.preferredRoles?.includes(item.role as WardrobeRole)) score += 2
  if (profile.preferredTopSubtypes?.includes(item.subtype)) score += 5
  if (profile.preferredBottomSubtypes?.includes(item.subtype)) score += 5
  if (profile.preferredShoeSubtypes?.includes(item.subtype)) score += 5
  if (profile.preferredOuterwearSubtypes?.includes(item.subtype)) score += 4
  if (
    profile.preferredStyles?.some((style) => item.styleTags.includes(style))
  ) {
    score += 4
  }
  if (profile.preferredFormality?.includes(item.formality)) score += 4
  if (profile.avoidSubtypes?.includes(item.subtype)) score -= 8

  if (
    request.weatherContext &&
    request.weatherContext.temperatureC >= 28 &&
    ['coat', 'hoodie', 'sweater', 'boots'].includes(item.subtype)
  ) {
    score -= 8
  }
  if (
    request.weatherContext &&
    request.weatherContext.temperatureC <= 8 &&
    ['shorts', 'tank_top', 'sandals'].includes(item.subtype)
  ) {
    score -= 7
  }

  if (item.role === 'shoes') score += 1
  if (item.role === 'top' || item.role === 'bottom') score += 2

  return score
}

export function filterAndRankWardrobe(
  items: StylistWardrobeItem[],
  request: StylistRequest,
) {
  const profile = getPreferredProfile(request)
  const filtered = items.filter((item) => {
    if (item.role === unresolvedWardrobeRole) return false
    if (profile.avoidSubtypes?.includes(item.subtype)) return false
    return true
  })

  return [...(filtered.length > 0 ? filtered : items)]
    .map((item) => ({ item, score: scoreItem(item, request) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}

export function findMissingCoreItems(items: StylistWardrobeItem[]) {
  const categories = new Set(items.map((item) => item.role))
  return requiredCoreCategories.filter((category) => !categories.has(category))
}

export function hasCompleteOutfit(items: StylistWardrobeItem[]) {
  return findMissingCoreItems(items).length === 0
}

export function isSingleItemStylistRequest(request: StylistRequest) {
  const prompt = buildPromptContext(request)

  return (
    /\b(suggest|choose|pick|select)\s+(only\s+)?(a\s+)?(top|shirt|t-shirt|tee|polo|shoes?|sneakers?|bottom|pants|jeans)\b/.test(
      prompt,
    ) ||
    /\b(only|just)\s+(a\s+)?(top|shirt|t-shirt|tee|polo|shoes?|sneakers?|bottom|pants|jeans)\b/.test(
      prompt,
    ) ||
    /\breplace\s+(one\s+item|my\s+)?(top|shirt|t-shirt|tee|polo|shoes?|sneakers?|bottom|pants|jeans|item)\b/.test(
      prompt,
    )
  )
}

export function getRequiredCategoriesForStylistRequest(
  request: StylistRequest,
) {
  return isSingleItemStylistRequest(request) ? [] : [...requiredCoreCategories]
}

export function findMissingRequiredCategories(
  items: StylistWardrobeItem[],
  requiredCategories: string[],
) {
  const categories = new Set(items.map((item) => item.role))
  return requiredCategories.filter((category) => !categories.has(category))
}

export function describeAvailableCategories(
  items: StylistWardrobeItem[],
  locale: StylistRequest['locale'],
) {
  return Array.from(new Set(items.map((item) => item.role))).map((role) =>
    getWardrobeColorFamilyLabel(locale, role),
  )
}
