import type {
  StylistProvider,
  StylistProviderInput,
  StylistBatchResult,
  StylistWardrobeItem,
} from './types'
import { buildLocalCandidateBatch } from './batch'

const copy = {
  az: {
    title: 'Balanslı gündəlik kombin',
    overall:
      'Bu kombində yalnız qarderobunuzdakı geyimlərdən istifadə etdim. Üst geyim, alt geyim və ayaqqabı birlikdə tamamlanmış görünüş yaradır.',
    missingPrefix: 'Tam kombin üçün çatışmayan hissə:',
  },
  en: {
    title: 'Balanced everyday outfit',
    overall:
      'I used only clothes from your wardrobe. The top, bottom, and shoes create a complete outfit with a clean balance.',
    missingPrefix: 'Missing piece for a complete outfit:',
  },
  ru: {
    title: 'Сбалансированный повседневный образ',
    overall:
      'Я использовал только вещи из вашего гардероба. Верх, низ и обувь вместе создают завершенный и аккуратный образ.',
    missingPrefix: 'Не хватает для полного образа:',
  },
}

function pickByCategory(items: StylistWardrobeItem[], category: string) {
  return items.find((item) => item.category === category)
}

function explain(locale: keyof typeof copy, item: StylistWardrobeItem) {
  if (locale === 'ru') {
    return `Я выбрал ${item.name}, потому что эта вещь подходит к запросу и хорошо работает в роли ${item.category}.`
  }
  if (locale === 'az') {
    return `${item.name} seçildi, çünki sorğuya uyğundur və ${item.category} rolunda yaxşı işləyir.`
  }
  return `I selected ${item.name} because it fits the request and works well as the ${item.category} piece.`
}

export class MockStylistProvider implements StylistProvider {
  async generateOutfit(
    input: StylistProviderInput,
  ): Promise<StylistBatchResult> {
    const locale = input.locale
    const availableCategories = Array.from(
      new Set(input.wardrobeItems.map((item) => item.category)),
    )
    if (input.missingItems.length > 0) {
      return {
        status: 'insufficient_wardrobe',
        message: `${copy[locale].missingPrefix} ${input.missingItems.join(', ')}.`,
        missingCategories: input.missingItems,
        availableCategories,
      }
    }

    const top = pickByCategory(input.wardrobeItems, 'tops')
    const bottom = pickByCategory(input.wardrobeItems, 'bottoms')
    const shoes = pickByCategory(input.wardrobeItems, 'shoes')
    const accessory =
      pickByCategory(input.wardrobeItems, 'accessories') ??
      pickByCategory(input.wardrobeItems, 'outerwear')
    const selected = [top, bottom, shoes, accessory].filter(
      Boolean,
    ) as StylistWardrobeItem[]

    const outfit = {
      status: 'success',
      outfit: {
        title: input.request.weatherContext
          ? `${copy[locale].title} - ${Math.round(input.request.weatherContext.temperatureC)}C`
          : copy[locale].title,
        occasion:
          input.request.occasion ?? input.request.quickRequest ?? 'general',
        styleDirection: 'relaxed',
        seasonLabel: '',
        formalityLabel: '',
        items: selected.map((item) => ({
          wardrobeItemId: item.id,
          role: item.category,
          explanation: explain(locale, item),
        })),
        overallExplanation: input.request.weatherContext
          ? `${copy[locale].overall} Weather context: ${input.request.weatherContext.condition}, ${Math.round(input.request.weatherContext.temperatureC)}C.`
          : copy[locale].overall,
        confidenceScore: 0.82,
        alternativeSuggestions: [],
        missingItems: [],
      },
    }

    return buildLocalCandidateBatch({
      baseOutfit: outfit.outfit,
      wardrobeItems: input.wardrobeItems,
      request: input.request,
      candidateCount: input.candidateCount ?? 3,
    })
  }
}
