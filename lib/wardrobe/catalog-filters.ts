import type { WardrobeItemDto } from './types'
import { normalizeWardrobeColorFamily } from './taxonomy'

export const CATALOG_PAGE_SIZE = 24
export const NOT_WORN_RECENTLY_DAYS = 30

export type CatalogFilters = {
  colors: string[]
  type: string
  material: string
  favoritesOnly: boolean
  notWornRecently: boolean
}

export const emptyCatalogFilters: CatalogFilters = {
  colors: [],
  type: '',
  material: '',
  favoritesOnly: false,
  notWornRecently: false,
}

export function hasCatalogFilters(filters: CatalogFilters) {
  return (
    filters.colors.length > 0 ||
    Boolean(filters.type) ||
    Boolean(filters.material) ||
    filters.favoritesOnly ||
    filters.notWornRecently
  )
}

export function getItemColorFamilies(item: WardrobeItemDto) {
  const colors = item.effectiveAnalysis?.colors ?? item.colors
  const families = new Set<string>()
  for (const color of colors) {
    const family = normalizeWardrobeColorFamily(color)
    if (family) families.add(family)
  }
  return families
}

export function getItemType(item: WardrobeItemDto) {
  return item.effectiveAnalysis?.detectedClothingType ?? item.clothingType
}

export function getItemMaterial(item: WardrobeItemDto) {
  return normalizeMaterial(item.effectiveAnalysis?.material ?? item.material)
}

function normalizeMaterial(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function isNotWornRecently(item: WardrobeItemDto, now: Date) {
  if (!item.lastWornAt) return true
  const days =
    (now.getTime() - new Date(item.lastWornAt).getTime()) / 86_400_000
  return days >= NOT_WORN_RECENTLY_DAYS
}

/** Options that actually occur in the wardrobe, so no filter leads nowhere. */
export function getCatalogFilterOptions(items: WardrobeItemDto[]) {
  const colors = new Set<string>()
  const types = new Set<string>()
  const materials = new Set<string>()
  for (const item of items) {
    getItemColorFamilies(item).forEach((color) => colors.add(color))
    const type = getItemType(item)
    if (type && type !== 'unresolved') types.add(type)
    const material = getItemMaterial(item)
    if (material) materials.add(material)
  }
  return {
    colors: [...colors],
    types: [...types].sort(),
    materials: [...materials].sort(),
  }
}

export function applyCatalogFilters(
  items: WardrobeItemDto[],
  filters: CatalogFilters,
  favoriteIds: ReadonlySet<string>,
  now = new Date(),
) {
  return items.filter((item) => {
    if (filters.colors.length > 0) {
      const families = getItemColorFamilies(item)
      if (!filters.colors.some((color) => families.has(color))) return false
    }
    if (filters.type && getItemType(item) !== filters.type) return false
    if (filters.material && getItemMaterial(item) !== filters.material)
      return false
    if (filters.favoritesOnly && !favoriteIds.has(item.id)) return false
    if (filters.notWornRecently && !isNotWornRecently(item, now)) return false
    return true
  })
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  return {
    page: current,
    pageCount,
    items: items.slice(start, start + pageSize),
  }
}
