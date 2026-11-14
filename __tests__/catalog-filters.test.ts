import { describe, expect, it } from 'vitest'
import {
  applyCatalogFilters,
  emptyCatalogFilters,
  getCatalogFilterOptions,
  paginate,
} from '@/lib/wardrobe/catalog-filters'
import type { WardrobeItemDto } from '@/lib/wardrobe/types'

function item(overrides: Partial<WardrobeItemDto>): WardrobeItemDto {
  return {
    id: 'id',
    clothingType: 't_shirt',
    colors: [],
    material: '',
    lastWornAt: null,
    effectiveAnalysis: null,
    ...overrides,
  } as WardrobeItemDto
}

const now = new Date('2026-11-14T12:00:00Z')
const items = [
  item({
    id: 'a',
    colors: ['black'],
    material: 'Cotton',
    lastWornAt: '2026-11-10T00:00:00Z',
  }),
  item({ id: 'b', colors: ['white', 'blue'], clothingType: 'jeans' }),
  item({
    id: 'c',
    colors: ['black'],
    clothingType: 'jacket',
    material: 'leather',
    lastWornAt: '2026-09-01T00:00:00Z',
  }),
]

describe('catalog filters', () => {
  it('matches any selected colour', () => {
    const result = applyCatalogFilters(
      items,
      { ...emptyCatalogFilters, colors: ['blue', 'black'] },
      new Set(),
      now,
    )
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    const onlyWhite = applyCatalogFilters(
      items,
      { ...emptyCatalogFilters, colors: ['white'] },
      new Set(),
      now,
    )
    expect(onlyWhite.map((i) => i.id)).toEqual(['b'])
  })

  it('combines type, material, favourites and not-worn filters', () => {
    expect(
      applyCatalogFilters(
        items,
        { ...emptyCatalogFilters, type: 'jacket' },
        new Set(),
        now,
      ).map((i) => i.id),
    ).toEqual(['c'])
    expect(
      applyCatalogFilters(
        items,
        { ...emptyCatalogFilters, material: 'cotton' },
        new Set(),
        now,
      ).map((i) => i.id),
    ).toEqual(['a'])
    expect(
      applyCatalogFilters(
        items,
        { ...emptyCatalogFilters, favoritesOnly: true },
        new Set(['b']),
        now,
      ).map((i) => i.id),
    ).toEqual(['b'])
    expect(
      applyCatalogFilters(
        items,
        { ...emptyCatalogFilters, notWornRecently: true },
        new Set(),
        now,
      ).map((i) => i.id),
    ).toEqual(['b', 'c'])
  })

  it('offers only options present in the wardrobe', () => {
    const options = getCatalogFilterOptions(items)
    expect(options.colors.sort()).toEqual(['black', 'blue', 'white'])
    expect(options.materials).toEqual(['cotton', 'leather'])
  })

  it('paginates and clamps the page', () => {
    const list = Array.from({ length: 50 }, (_, index) => index)
    expect(paginate(list, 3, 24)).toEqual({
      page: 3,
      pageCount: 3,
      items: [48, 49],
    })
    expect(paginate(list, 9, 24).page).toBe(3)
    expect(paginate([], 1, 24)).toEqual({ page: 1, pageCount: 1, items: [] })
  })
})
