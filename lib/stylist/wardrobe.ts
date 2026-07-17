import type { wardrobeItem } from '@/lib/db/schema'
import type {
  QuickRequestId,
  StylistRequest,
  StylistWardrobeItem,
} from './types'

type WardrobeRow = typeof wardrobeItem.$inferSelect

const requestStyles: Partial<Record<QuickRequestId, string[]>> = {
  old_money: ['classic', 'minimal', 'formal'],
  luxury: ['classic', 'formal', 'evening'],
  streetwear: ['streetwear', 'casual'],
  sport: ['sport'],
  business: ['business', 'formal', 'classic'],
  work: ['business', 'formal', 'classic'],
  wedding: ['formal', 'evening', 'classic'],
  date: ['evening', 'classic', 'casual'],
  restaurant: ['evening', 'classic', 'casual'],
  university: ['casual', 'minimal', 'sport'],
}

const requestSeasons: Partial<Record<QuickRequestId, string[]>> = {
  cold_weather: ['winter', 'autumn'],
  hot_weather: ['summer', 'spring'],
  rain: ['autumn', 'spring', 'winter'],
  vacation: ['summer', 'spring'],
}

export const requiredCoreCategories = ['tops', 'bottoms', 'shoes'] as const

const categoryAliases: Record<string, string> = {
  top: 'tops',
  tops: 'tops',
  shirt: 'tops',
  't-shirt': 'tops',
  tshirt: 'tops',
  tee: 'tops',
  blouse: 'tops',
  sweater: 'tops',
  sweatshirt: 'tops',
  hoodie: 'tops',
  polo: 'tops',
  'tank-top': 'tops',
  köynək: 'tops',
  koynek: 'tops',
  футболка: 'tops',
  рубашка: 'tops',
  верх: 'tops',
  bottom: 'bottoms',
  bottoms: 'bottoms',
  pants: 'bottoms',
  trousers: 'bottoms',
  jeans: 'bottoms',
  shorts: 'bottoms',
  skirt: 'bottoms',
  leggings: 'bottoms',
  şalvar: 'bottoms',
  salvar: 'bottoms',
  брюки: 'bottoms',
  джинсы: 'bottoms',
  низ: 'bottoms',
  shoe: 'shoes',
  shoes: 'shoes',
  footwear: 'shoes',
  sneaker: 'shoes',
  sneakers: 'shoes',
  trainers: 'shoes',
  boots: 'shoes',
  loafers: 'shoes',
  heels: 'shoes',
  sandals: 'shoes',
  ayaqqabı: 'shoes',
  ayaqqabi: 'shoes',
  обувь: 'shoes',
  dress: 'dresses',
  dresses: 'dresses',
  jumpsuit: 'dresses',
  suit: 'dresses',
  'one-piece': 'dresses',
  платье: 'dresses',
  jacket: 'outerwear',
  coat: 'outerwear',
  blazer: 'outerwear',
  cardigan: 'outerwear',
  vest: 'outerwear',
  outerwear: 'outerwear',
  'верхняя-одежда': 'outerwear',
  bag: 'bags',
  bags: 'bags',
  accessory: 'accessories',
  accessories: 'accessories',
  belt: 'accessories',
  hat: 'accessories',
  cap: 'accessories',
  scarf: 'accessories',
  jewelry: 'accessories',
  watch: 'accessories',
  glasses: 'accessories',
  аксессуар: 'accessories',
  аксессуары: 'accessories',
}

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
}

export function normalizeStylistCategory(category: string, clothingType = '') {
  const normalizedCategory = categoryAliases[normalizeToken(category)]
  if (normalizedCategory && normalizedCategory !== 'other') {
    return normalizedCategory
  }

  const normalizedType = normalizeToken(clothingType)
  return categoryAliases[normalizedType] ?? normalizedCategory ?? 'other'
}

export type StylistRoleResolutionSource =
  | 'wardrobe_category'
  | 'wardrobe_clothing_type'
  | 'provider_role'
  | 'unresolved'

export type StylistRoleResolution = {
  role: string
  source: StylistRoleResolutionSource
}

export function resolveStylistOutfitRole(input: {
  providerRole?: string
  wardrobeCategory?: string
  wardrobeSubcategory?: string
}): StylistRoleResolution {
  const categoryRole = normalizeStylistCategory(input.wardrobeCategory ?? '')
  if (categoryRole !== 'other') {
    return { role: categoryRole, source: 'wardrobe_category' }
  }

  const clothingTypeRole = normalizeStylistCategory(
    '',
    input.wardrobeSubcategory ?? '',
  )
  if (clothingTypeRole !== 'other') {
    return { role: clothingTypeRole, source: 'wardrobe_clothing_type' }
  }

  const providerRole = normalizeStylistCategory(input.providerRole ?? '')
  if (providerRole !== 'other') {
    return { role: providerRole, source: 'provider_role' }
  }

  return { role: 'other', source: 'unresolved' }
}

export function toStylistWardrobeItem(row: WardrobeRow): StylistWardrobeItem {
  return {
    id: row.id,
    name: row.name,
    category: normalizeStylistCategory(row.category, row.clothingType),
    clothingType: row.clothingType,
    colors: row.colors,
    seasons: row.seasons,
    styles: row.styles,
    material: row.material,
    brand: row.brand,
    notes: row.notes,
    imageUrl: row.processedImageUrl ?? row.imageUrl,
  }
}

export function getStylistWardrobeDiagnostics(rows: WardrobeRow[]) {
  const activeRows = rows.filter((row) => row.imageDeletionStatus === 'active')
  const excludedRows = rows.filter(
    (row) => row.imageDeletionStatus !== 'active',
  )
  const normalizedItems = activeRows.map(toStylistWardrobeItem)
  const categories = countBy(normalizedItems.map((item) => item.category))
  const analysisStatuses = countBy(rows.map((row) => row.analysisStatus))

  return {
    eligibleItemCount: normalizedItems.length,
    categories,
    analysisStatuses,
    excluded: {
      imageDeletionNotActive: excludedRows.length,
    },
  }
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function scoreItem(item: StylistWardrobeItem, request: StylistRequest) {
  const prompt =
    `${request.message} ${request.quickRequest ?? ''}`.toLowerCase()
  const desiredStyles = request.quickRequest
    ? (requestStyles[request.quickRequest] ?? [])
    : []
  const desiredSeasons = request.quickRequest
    ? (requestSeasons[request.quickRequest] ?? [])
    : []

  let score = 0
  if (prompt.includes(item.name.toLowerCase())) score += 4
  if (prompt.includes(item.clothingType.toLowerCase())) score += 3
  if (prompt.includes(item.category.toLowerCase())) score += 2
  score +=
    item.styles.filter((style) => desiredStyles.includes(style)).length * 3
  score +=
    item.seasons.filter((season) => desiredSeasons.includes(season)).length * 2
  score += item.colors.filter((color) => prompt.includes(color)).length
  if (item.category === 'shoes') score += 1
  if (item.category === 'tops' || item.category === 'bottoms') score += 2

  return score
}

export function filterAndRankWardrobe(
  items: StylistWardrobeItem[],
  request: StylistRequest,
) {
  const desiredStyles = request.quickRequest
    ? (requestStyles[request.quickRequest] ?? [])
    : []
  const desiredSeasons = request.quickRequest
    ? (requestSeasons[request.quickRequest] ?? [])
    : []

  const filtered = items.filter((item) => {
    const styleOk =
      desiredStyles.length === 0 ||
      item.styles.length === 0 ||
      item.styles.some((style) => desiredStyles.includes(style))
    const seasonOk =
      desiredSeasons.length === 0 ||
      item.seasons.length === 0 ||
      item.seasons.some((season) => desiredSeasons.includes(season))

    return styleOk && seasonOk
  })

  return [...(filtered.length > 0 ? filtered : items)]
    .map((item) => ({ item, score: scoreItem(item, request) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}

export function findMissingCoreItems(items: StylistWardrobeItem[]) {
  const categories = new Set(items.map((item) => item.category))
  return requiredCoreCategories.filter((category) => !categories.has(category))
}

export function hasCompleteOutfit(items: StylistWardrobeItem[]) {
  return findMissingCoreItems(items).length === 0
}

export function isSingleItemStylistRequest(request: StylistRequest) {
  const prompt =
    `${request.message} ${request.quickRequest ?? ''}`.toLowerCase()

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
  const categories = new Set(items.map((item) => item.category))
  return requiredCategories.filter((category) => !categories.has(category))
}
