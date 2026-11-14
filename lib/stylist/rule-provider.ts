import type { Locale } from '@/lib/i18n/config'
import { getWardrobeColorFamilyLabel } from '@/lib/wardrobe/taxonomy'
import { scoreStylistCandidate } from './scoring'
import type {
  StylistBatchResult,
  StylistCandidate,
  StylistProvider,
  StylistProviderInput,
  StylistWardrobeItem,
} from './types'

/**
 * Free stylist that needs no paid AI. It combines the user's own items into
 * complete outfits (top + bottom or a one-piece, shoes, optional outer layer),
 * scores every combination with the same colour, occasion, formality and
 * weather rules the AI path is validated against, and returns the best
 * distinct options.
 */

const PER_ROLE_LIMIT = 6
const MAX_SHARED_ITEMS = 1

const copy = {
  az: {
    title: ['Gündəlik balans', 'Rahat və səliqəli', 'Bir az daha cəsur'],
    missingPrefix: 'Tam obraz üçün çatışmayan hissə:',
    overall:
      'Obraz qarderobunuzdakı geyimlərdən rəng uyğunluğu, mövsüm və tədbir qaydalarına görə seçildi.',
    weather: 'Hava: {temp}°C.',
    item: '{name} — {color} ton obrazı tamamlayır.',
    itemNoColor: '{name} obrazın {role} hissəsidir.',
  },
  en: {
    title: ['Everyday balance', 'Relaxed and neat', 'A little bolder'],
    missingPrefix: 'Missing piece for a complete outfit:',
    overall:
      'Built from your own wardrobe using colour harmony, season and occasion rules.',
    weather: 'Weather: {temp}°C.',
    item: '{name} — its {color} tone ties the outfit together.',
    itemNoColor: '{name} covers the {role} of the outfit.',
  },
  ru: {
    title: ['Повседневный баланс', 'Спокойно и аккуратно', 'Чуть смелее'],
    missingPrefix: 'Не хватает для полного образа:',
    overall:
      'Собрано из ваших вещей по правилам сочетания цветов, сезона и повода.',
    weather: 'Погода: {temp}°C.',
    item: '{name} — {color} оттенок связывает образ.',
    itemNoColor: '{name} закрывает в образе роль «{role}».',
  },
} as const satisfies Record<Locale, unknown>

function byRole(items: StylistWardrobeItem[], role: string) {
  return items.filter((item) => item.role === role).slice(0, PER_ROLE_LIMIT)
}

function explain(locale: Locale, item: StylistWardrobeItem) {
  const t = copy[locale]
  const color = item.colorFamilies[0]
  return color
    ? t.item
        .replace('{name}', item.name)
        .replace('{color}', getWardrobeColorFamilyLabel(locale, color))
    : t.itemNoColor.replace('{name}', item.name).replace('{role}', item.role)
}

function buildBases(items: StylistWardrobeItem[]) {
  const tops = byRole(items, 'top')
  const bottoms = byRole(items, 'bottom')
  const onePieces = byRole(items, 'one_piece')
  const bases: StylistWardrobeItem[][] = []
  for (const top of tops) {
    for (const bottom of bottoms) bases.push([top, bottom])
  }
  for (const onePiece of onePieces) bases.push([onePiece])
  return bases
}

function toCandidate(
  input: StylistProviderInput,
  selected: StylistWardrobeItem[],
  index: number,
): StylistCandidate {
  const t = copy[input.locale]
  const weather = input.request.weatherContext
  return {
    title: t.title[index % t.title.length],
    occasion: input.request.occasion ?? input.request.quickRequest ?? '',
    styleDirection: '',
    seasonLabel: selected.flatMap((item) => item.seasons)[0] ?? '',
    formalityLabel: selected.find((item) => item.formality)?.formality ?? '',
    items: selected.map((item) => ({
      wardrobeItemId: item.id,
      role: item.role,
      explanation: explain(input.locale, item),
    })),
    overallExplanation: weather
      ? `${t.overall} ${t.weather.replace('{temp}', String(Math.round(weather.temperatureC)))}`
      : t.overall,
    confidenceScore: 0.7,
    alternativeSuggestions: [],
    missingItems: [],
  } as StylistCandidate
}

export class RuleStylistProvider implements StylistProvider {
  async generateOutfit(
    input: StylistProviderInput,
  ): Promise<StylistBatchResult> {
    const availableCategories = Array.from(
      new Set(input.wardrobeItems.map((item) => item.role)),
    )
    if (input.missingItems.length > 0) {
      return {
        status: 'insufficient_wardrobe',
        message: `${copy[input.locale].missingPrefix} ${input.missingItems.join(', ')}.`,
        missingCategories: input.missingItems,
        availableCategories,
      }
    }

    const items = input.wardrobeItems
    const locked = items.filter((item) =>
      input.lockedItemIds?.includes(item.id),
    )
    const shoes = byRole(items, 'shoes')
    const outer = byRole(items, 'outerwear').slice(0, 3)
    const outerOptions: (StylistWardrobeItem | null)[] = [null, ...outer]
    const shoeOptions: (StylistWardrobeItem | null)[] =
      shoes.length > 0 ? shoes : [null]

    const scored: { items: StylistWardrobeItem[]; score: number }[] = []
    for (const base of buildBases(items)) {
      for (const shoe of shoeOptions) {
        for (const layer of outerOptions) {
          const selected = [...base, shoe, layer].filter(
            (item): item is StylistWardrobeItem => item !== null,
          )
          if (locked.some((item) => !selected.includes(item))) continue
          const candidate = toCandidate(input, selected, 0)
          const result = scoreStylistCandidate({
            candidate,
            selectedItems: selected,
            request: input.request,
          })
          if (result.rejectionReasons.length > 0) continue
          scored.push({ items: selected, score: result.candidateScore })
        }
      }
    }

    scored.sort((left, right) => right.score - left.score)
    const target = Math.min(Math.max(input.candidateCount ?? 3, 1), 5)
    const accepted: StylistWardrobeItem[][] = []
    for (const option of scored) {
      if (accepted.length >= target) break
      const ids = new Set(option.items.map((item) => item.id))
      const tooSimilar = accepted.some(
        (other) =>
          other.filter((item) => ids.has(item.id)).length > MAX_SHARED_ITEMS,
      )
      if (!tooSimilar) accepted.push(option.items)
    }
    // Small wardrobes cannot always give fully distinct outfits.
    for (const option of scored) {
      if (accepted.length >= target) break
      if (!accepted.includes(option.items)) accepted.push(option.items)
    }

    if (accepted.length === 0) {
      return {
        status: 'insufficient_wardrobe',
        message: `${copy[input.locale].missingPrefix} top, bottom, shoes.`,
        missingCategories: ['top', 'bottom', 'shoes'],
        availableCategories,
      }
    }

    return {
      status: 'success',
      candidates: accepted.map((selected, index) =>
        toCandidate(input, selected, index),
      ),
      limitedVariety: accepted.length < target,
      message: '',
    } as StylistBatchResult
  }
}
