'use client'

import { Check, ChevronLeft, ChevronRight, Clock, Heart, X } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import {
  getWardrobeColorFamilyLabel,
  getWardrobeSubtypeLabel,
} from '@/lib/wardrobe/taxonomy'
import {
  emptyCatalogFilters,
  hasCatalogFilters,
  type CatalogFilters,
} from '@/lib/wardrobe/catalog-filters'
import { cn } from '@/lib/utils'

export const colorSwatches: Record<string, string> = {
  black: '#1c1b19',
  white: '#ffffff',
  gray: '#9a9792',
  navy: '#1f2a44',
  blue: '#3a6ea5',
  beige: '#d9c7a7',
  brown: '#7a5235',
  green: '#4f7a4a',
  red: '#b3362f',
  burgundy: '#6e1f2e',
  pink: '#e3a3b5',
  yellow: '#e8c547',
  orange: '#dd7a32',
  purple: '#6f4b8b',
}

const copy = {
  az: {
    colors: 'Rəng',
    type: 'Növ',
    allTypes: 'Bütün növlər',
    material: 'Material',
    allMaterials: 'Bütün materiallar',
    favorites: 'Seçilmişlər',
    notWorn: '30 gündür geyinilməyib',
    reset: 'Sıfırla',
    page: 'Səhifə {page} / {count}',
    prev: 'Əvvəlki səhifə',
    next: 'Növbəti səhifə',
  },
  en: {
    colors: 'Colour',
    type: 'Type',
    allTypes: 'All types',
    material: 'Material',
    allMaterials: 'All materials',
    favorites: 'Favourites',
    notWorn: 'Not worn in 30 days',
    reset: 'Reset',
    page: 'Page {page} of {count}',
    prev: 'Previous page',
    next: 'Next page',
  },
  ru: {
    colors: 'Цвет',
    type: 'Тип',
    allTypes: 'Все типы',
    material: 'Материал',
    allMaterials: 'Все материалы',
    favorites: 'Избранное',
    notWorn: 'Не носил 30 дней',
    reset: 'Сбросить',
    page: 'Страница {page} из {count}',
    prev: 'Предыдущая страница',
    next: 'Следующая страница',
  },
} as const

const chipClass =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function CatalogFilterBar({
  locale,
  filters,
  options,
  onChange,
}: {
  locale: Locale
  filters: CatalogFilters
  options: { colors: string[]; types: string[]; materials: string[] }
  onChange: (next: CatalogFilters) => void
}) {
  const t = copy[locale]
  const toggleColor = (color: string) =>
    onChange({
      ...filters,
      colors: filters.colors.includes(color)
        ? filters.colors.filter((value) => value !== color)
        : [...filters.colors, color],
    })
  const orderedColors = Object.keys(colorSwatches).filter((color) =>
    options.colors.includes(color),
  )

  return (
    <div className="grid gap-3">
      {orderedColors.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t.colors}
        >
          {orderedColors.map((color) => {
            const active = filters.colors.includes(color)
            const label = getWardrobeColorFamilyLabel(locale, color)
            return (
              <button
                key={color}
                type="button"
                onClick={() => toggleColor(color)}
                aria-pressed={active}
                aria-label={label}
                title={label}
                className={cn(
                  'grid size-9 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  active
                    ? 'border-foreground ring-2 ring-foreground/20'
                    : 'border-foreground/15 hover:border-foreground/40',
                )}
              >
                <span
                  className="grid size-6 place-items-center rounded-full border border-foreground/10"
                  style={{ backgroundColor: colorSwatches[color] }}
                >
                  {active && (
                    <Check
                      className={cn(
                        'size-3.5',
                        ['white', 'beige', 'yellow', 'pink'].includes(color)
                          ? 'text-foreground'
                          : 'text-white',
                      )}
                      aria-hidden="true"
                    />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {options.types.length > 0 && (
          <select
            value={filters.type}
            onChange={(event) =>
              onChange({ ...filters, type: event.target.value })
            }
            aria-label={t.type}
            className="h-9 rounded-full border border-input bg-background px-3 text-sm"
          >
            <option value="">{t.allTypes}</option>
            {options.types.map((type) => (
              <option key={type} value={type}>
                {getWardrobeSubtypeLabel(locale, type)}
              </option>
            ))}
          </select>
        )}
        {options.materials.length > 0 && (
          <select
            value={filters.material}
            onChange={(event) =>
              onChange({ ...filters, material: event.target.value })
            }
            aria-label={t.material}
            className="h-9 rounded-full border border-input bg-background px-3 text-sm"
          >
            <option value="">{t.allMaterials}</option>
            {options.materials.map((material) => (
              <option key={material} value={material}>
                {material}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          aria-pressed={filters.favoritesOnly}
          onClick={() =>
            onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })
          }
          className={cn(
            chipClass,
            filters.favoritesOnly
              ? 'border-foreground bg-foreground text-background'
              : 'border-input hover:border-foreground/40',
          )}
        >
          <Heart className="size-4" aria-hidden="true" />
          {t.favorites}
        </button>
        <button
          type="button"
          aria-pressed={filters.notWornRecently}
          onClick={() =>
            onChange({ ...filters, notWornRecently: !filters.notWornRecently })
          }
          className={cn(
            chipClass,
            filters.notWornRecently
              ? 'border-foreground bg-foreground text-background'
              : 'border-input hover:border-foreground/40',
          )}
        >
          <Clock className="size-4" aria-hidden="true" />
          {t.notWorn}
        </button>
        {hasCatalogFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange(emptyCatalogFilters)}
            className={cn(
              chipClass,
              'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <X className="size-4" aria-hidden="true" />
            {t.reset}
          </button>
        )}
      </div>
    </div>
  )
}

export function CatalogPagination({
  locale,
  page,
  pageCount,
  onPageChange,
}: {
  locale: Locale
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  const t = copy[locale]
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1.5"
      aria-label={t.page
        .replace('{page}', String(page))
        .replace('{count}', String(pageCount))}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label={t.prev}
        className={cn(chipClass, 'border-input px-2 disabled:opacity-40')}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      {pages.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onPageChange(value)}
          aria-current={value === page ? 'page' : undefined}
          className={cn(
            chipClass,
            'min-w-9 justify-center px-2',
            value === page
              ? 'border-foreground bg-foreground text-background'
              : 'border-input hover:border-foreground/40',
          )}
        >
          {value}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        aria-label={t.next}
        className={cn(chipClass, 'border-input px-2 disabled:opacity-40')}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  )
}
