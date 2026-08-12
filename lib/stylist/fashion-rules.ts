import type { WeatherSuitabilitySignal } from '@/lib/weather'
import {
  getWardrobeFormalityLevel,
  type WardrobeColorFamily,
} from '@/lib/wardrobe/taxonomy'
import type {
  QuickRequestId,
  StylistRequest,
  StylistWardrobeItem,
} from './types'

export type OccasionProfileId =
  | 'everyday'
  | 'university'
  | 'work'
  | 'business'
  | 'formal_event'
  | 'date'
  | 'party'
  | 'sport'
  | 'travel'
  | 'outdoor'
  | 'dinner'
  | 'streetwear'
  | 'hot_weather'
  | 'cold_weather'
  | 'rain'

export type OccasionProfile = {
  id: OccasionProfileId
  targetFormality: number
  allowedFormalityRange: [number, number]
  preferredStyles: string[]
  compatibleStyles: string[]
  preferredTopSubtypes: string[]
  preferredBottomSubtypes: string[]
  preferredShoeSubtypes: string[]
  preferredOuterwearSubtypes: string[]
  discouragedSubtypes: string[]
  hardRejectedSubtypes: string[]
  weatherSensitivity: 'low' | 'medium' | 'high'
  preferOuterwearInCold: boolean
  preferOuterwearInRain: boolean
}

type SubtypeCompatibilityRule = {
  contexts: Array<OccasionProfileId | 'all'>
  top?: string[]
  bottom?: string[]
  shoes?: string[]
  outerwear?: string[]
  bonus: number
}

const subtypeCompatibilityRules: SubtypeCompatibilityRule[] = [
  {
    contexts: ['everyday', 'university', 'travel', 'hot_weather', 'all'],
    top: ['t_shirt'],
    bottom: ['jeans'],
    shoes: ['sneakers'],
    bonus: 9,
  },
  {
    contexts: ['everyday', 'hot_weather', 'travel'],
    top: ['t_shirt'],
    bottom: ['shorts'],
    shoes: ['sneakers', 'sandals'],
    bonus: 9,
  },
  {
    contexts: ['work', 'university', 'date', 'dinner'],
    top: ['polo'],
    bottom: ['chinos'],
    shoes: ['sneakers', 'loafers'],
    bonus: 10,
  },
  {
    contexts: ['work', 'business', 'date', 'dinner'],
    top: ['shirt'],
    bottom: ['chinos', 'trousers'],
    shoes: ['sneakers', 'loafers', 'dress_shoes'],
    bonus: 11,
  },
  {
    contexts: ['cold_weather', 'everyday', 'university', 'streetwear'],
    top: ['hoodie'],
    bottom: ['jeans', 'joggers', 'sweatpants'],
    shoes: ['sneakers', 'boots'],
    bonus: 9,
  },
  {
    contexts: ['business', 'formal_event', 'work', 'dinner'],
    top: ['shirt'],
    bottom: ['trousers'],
    shoes: ['dress_shoes', 'loafers'],
    outerwear: ['blazer'],
    bonus: 12,
  },
  {
    contexts: ['sport'],
    top: ['t_shirt', 'tank_top', 'sweatshirt'],
    bottom: ['shorts', 'joggers', 'sweatpants'],
    shoes: ['sneakers'],
    bonus: 12,
  },
  {
    contexts: ['streetwear'],
    top: ['t_shirt', 'hoodie', 'sweatshirt'],
    bottom: ['jeans', 'joggers'],
    shoes: ['sneakers'],
    bonus: 10,
  },
  {
    contexts: ['cold_weather', 'rain', 'outdoor'],
    top: ['sweater', 'hoodie', 'shirt'],
    bottom: ['jeans', 'trousers', 'joggers'],
    shoes: ['boots', 'sneakers'],
    outerwear: ['jacket', 'coat', 'cardigan', 'blazer'],
    bonus: 11,
  },
]

const styleCompatibilityGroups = [
  ['casual', 'relaxed', 'minimal', 'smart_casual'],
  ['business', 'formal', 'classic', 'smart_casual'],
  ['streetwear', 'relaxed', 'casual'],
  ['sport', 'casual', 'relaxed'],
  ['classic', 'minimal', 'old_money', 'business'],
] as const

const complementaryColors: Array<[WardrobeColorFamily, WardrobeColorFamily]> = [
  ['navy', 'beige'],
  ['blue', 'brown'],
  ['green', 'beige'],
  ['green', 'brown'],
  ['burgundy', 'gray'],
  ['red', 'black'],
  ['purple', 'gray'],
]

const analogousColors: Array<[WardrobeColorFamily, WardrobeColorFamily]> = [
  ['navy', 'blue'],
  ['blue', 'gray'],
  ['beige', 'brown'],
  ['green', 'beige'],
  ['red', 'burgundy'],
  ['pink', 'purple'],
]

const neutralColors = new Set<WardrobeColorFamily>([
  'black',
  'white',
  'gray',
  'navy',
  'beige',
  'brown',
])

const earthColors = new Set<WardrobeColorFamily>(['beige', 'brown', 'green'])

const strongAccentColors = new Set<WardrobeColorFamily>([
  'red',
  'orange',
  'yellow',
  'pink',
  'purple',
])

const weatherHeavySubtypes = new Set([
  'coat',
  'hoodie',
  'sweater',
  'sweatshirt',
  'boots',
  'jacket',
])

const weatherLightSubtypes = new Set([
  'shorts',
  'tank_top',
  'sandals',
  't_shirt',
  'polo',
])

const formalityPenalties = {
  sportMismatch: 10,
  formalMismatch: 12,
  severeGap: 9,
} as const

export const occasionProfiles: Record<OccasionProfileId, OccasionProfile> = {
  everyday: {
    id: 'everyday',
    targetFormality: 2,
    allowedFormalityRange: [1, 3],
    preferredStyles: ['casual', 'minimal', 'relaxed'],
    compatibleStyles: ['smart_casual', 'streetwear'],
    preferredTopSubtypes: ['t_shirt', 'polo', 'shirt', 'hoodie', 'sweater'],
    preferredBottomSubtypes: ['jeans', 'chinos', 'shorts', 'trousers'],
    preferredShoeSubtypes: ['sneakers', 'loafers', 'sandals'],
    preferredOuterwearSubtypes: ['jacket', 'cardigan', 'overshirt'],
    discouragedSubtypes: ['dress_shoes', 'heels'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'medium',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  university: {
    id: 'university',
    targetFormality: 2,
    allowedFormalityRange: [1, 3],
    preferredStyles: ['casual', 'relaxed', 'smart_casual'],
    compatibleStyles: ['minimal', 'streetwear'],
    preferredTopSubtypes: ['t_shirt', 'polo', 'shirt', 'hoodie', 'sweater'],
    preferredBottomSubtypes: ['jeans', 'chinos', 'shorts', 'joggers'],
    preferredShoeSubtypes: ['sneakers', 'loafers'],
    preferredOuterwearSubtypes: ['jacket', 'cardigan', 'overshirt'],
    discouragedSubtypes: ['dress_shoes', 'heels'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'medium',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  work: {
    id: 'work',
    targetFormality: 3,
    allowedFormalityRange: [2, 4],
    preferredStyles: ['smart_casual', 'business', 'classic'],
    compatibleStyles: ['minimal', 'casual'],
    preferredTopSubtypes: ['shirt', 'polo', 'sweater'],
    preferredBottomSubtypes: ['trousers', 'chinos', 'jeans'],
    preferredShoeSubtypes: ['loafers', 'dress_shoes', 'sneakers'],
    preferredOuterwearSubtypes: ['blazer', 'cardigan', 'jacket'],
    discouragedSubtypes: ['shorts', 'sweatpants'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'medium',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  business: {
    id: 'business',
    targetFormality: 4,
    allowedFormalityRange: [3, 5],
    preferredStyles: ['business', 'classic', 'formal'],
    compatibleStyles: ['smart_casual', 'minimal'],
    preferredTopSubtypes: ['shirt', 'polo'],
    preferredBottomSubtypes: ['trousers', 'chinos'],
    preferredShoeSubtypes: ['dress_shoes', 'loafers'],
    preferredOuterwearSubtypes: ['blazer', 'coat'],
    discouragedSubtypes: ['jeans', 'sneakers'],
    hardRejectedSubtypes: ['shorts', 'joggers', 'sweatpants'],
    weatherSensitivity: 'high',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  formal_event: {
    id: 'formal_event',
    targetFormality: 5,
    allowedFormalityRange: [4, 5],
    preferredStyles: ['formal', 'classic', 'business'],
    compatibleStyles: ['minimal'],
    preferredTopSubtypes: ['shirt'],
    preferredBottomSubtypes: ['trousers'],
    preferredShoeSubtypes: ['dress_shoes', 'loafers', 'heels'],
    preferredOuterwearSubtypes: ['blazer', 'coat'],
    discouragedSubtypes: ['sneakers'],
    hardRejectedSubtypes: ['shorts', 'joggers', 'sweatpants', 'hoodie'],
    weatherSensitivity: 'high',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  date: {
    id: 'date',
    targetFormality: 3,
    allowedFormalityRange: [2, 4],
    preferredStyles: ['smart_casual', 'classic', 'minimal'],
    compatibleStyles: ['casual', 'evening'],
    preferredTopSubtypes: ['shirt', 'polo', 'sweater'],
    preferredBottomSubtypes: ['jeans', 'chinos', 'trousers'],
    preferredShoeSubtypes: ['loafers', 'sneakers', 'heels'],
    preferredOuterwearSubtypes: ['blazer', 'cardigan', 'jacket'],
    discouragedSubtypes: ['sweatpants'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'medium',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  party: {
    id: 'party',
    targetFormality: 3,
    allowedFormalityRange: [2, 4],
    preferredStyles: ['streetwear', 'evening', 'minimal'],
    compatibleStyles: ['casual', 'classic'],
    preferredTopSubtypes: ['shirt', 't_shirt', 'hoodie'],
    preferredBottomSubtypes: ['jeans', 'trousers'],
    preferredShoeSubtypes: ['sneakers', 'loafers', 'heels'],
    preferredOuterwearSubtypes: ['blazer', 'jacket'],
    discouragedSubtypes: ['sweatpants'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'low',
    preferOuterwearInCold: true,
    preferOuterwearInRain: false,
  },
  sport: {
    id: 'sport',
    targetFormality: 1,
    allowedFormalityRange: [1, 2],
    preferredStyles: ['sport', 'casual'],
    compatibleStyles: ['relaxed'],
    preferredTopSubtypes: ['t_shirt', 'tank_top', 'sweatshirt'],
    preferredBottomSubtypes: ['shorts', 'joggers', 'sweatpants'],
    preferredShoeSubtypes: ['sneakers'],
    preferredOuterwearSubtypes: ['jacket', 'hoodie'],
    discouragedSubtypes: ['shirt', 'trousers'],
    hardRejectedSubtypes: ['dress_shoes', 'heels', 'blazer'],
    weatherSensitivity: 'high',
    preferOuterwearInCold: false,
    preferOuterwearInRain: false,
  },
  travel: {
    id: 'travel',
    targetFormality: 2,
    allowedFormalityRange: [1, 3],
    preferredStyles: ['casual', 'relaxed', 'minimal'],
    compatibleStyles: ['streetwear', 'sport'],
    preferredTopSubtypes: ['t_shirt', 'hoodie', 'sweater', 'shirt'],
    preferredBottomSubtypes: ['jeans', 'joggers', 'chinos', 'shorts'],
    preferredShoeSubtypes: ['sneakers', 'boots', 'loafers'],
    preferredOuterwearSubtypes: ['jacket', 'cardigan', 'overshirt'],
    discouragedSubtypes: ['heels'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'high',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  outdoor: {
    id: 'outdoor',
    targetFormality: 2,
    allowedFormalityRange: [1, 3],
    preferredStyles: ['casual', 'sport', 'relaxed'],
    compatibleStyles: ['streetwear'],
    preferredTopSubtypes: ['hoodie', 't_shirt', 'sweater'],
    preferredBottomSubtypes: ['joggers', 'jeans', 'shorts'],
    preferredShoeSubtypes: ['boots', 'sneakers'],
    preferredOuterwearSubtypes: ['jacket', 'coat', 'vest'],
    discouragedSubtypes: ['heels', 'dress_shoes'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'high',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  dinner: {
    id: 'dinner',
    targetFormality: 3,
    allowedFormalityRange: [2, 4],
    preferredStyles: ['smart_casual', 'classic', 'minimal'],
    compatibleStyles: ['business', 'casual'],
    preferredTopSubtypes: ['shirt', 'polo', 'sweater'],
    preferredBottomSubtypes: ['trousers', 'chinos', 'jeans'],
    preferredShoeSubtypes: ['loafers', 'dress_shoes', 'sneakers'],
    preferredOuterwearSubtypes: ['blazer', 'cardigan'],
    discouragedSubtypes: ['sweatpants'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'medium',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  streetwear: {
    id: 'streetwear',
    targetFormality: 2,
    allowedFormalityRange: [1, 3],
    preferredStyles: ['streetwear', 'relaxed', 'casual'],
    compatibleStyles: ['sport', 'minimal'],
    preferredTopSubtypes: ['t_shirt', 'hoodie', 'sweatshirt'],
    preferredBottomSubtypes: ['jeans', 'joggers', 'shorts'],
    preferredShoeSubtypes: ['sneakers', 'boots'],
    preferredOuterwearSubtypes: ['jacket', 'overshirt', 'vest'],
    discouragedSubtypes: ['dress_shoes', 'heels'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'medium',
    preferOuterwearInCold: true,
    preferOuterwearInRain: false,
  },
  hot_weather: {
    id: 'hot_weather',
    targetFormality: 2,
    allowedFormalityRange: [1, 3],
    preferredStyles: ['casual', 'minimal', 'smart_casual'],
    compatibleStyles: ['sport', 'classic'],
    preferredTopSubtypes: ['t_shirt', 'polo', 'shirt', 'tank_top'],
    preferredBottomSubtypes: ['shorts', 'chinos', 'trousers'],
    preferredShoeSubtypes: ['sneakers', 'sandals', 'loafers'],
    preferredOuterwearSubtypes: ['overshirt', 'cardigan'],
    discouragedSubtypes: ['boots', 'hoodie', 'coat'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'high',
    preferOuterwearInCold: false,
    preferOuterwearInRain: false,
  },
  cold_weather: {
    id: 'cold_weather',
    targetFormality: 2,
    allowedFormalityRange: [1, 4],
    preferredStyles: ['casual', 'classic', 'smart_casual'],
    compatibleStyles: ['streetwear', 'business'],
    preferredTopSubtypes: ['sweater', 'hoodie', 'shirt', 'sweatshirt'],
    preferredBottomSubtypes: ['jeans', 'trousers', 'joggers'],
    preferredShoeSubtypes: ['boots', 'sneakers', 'loafers'],
    preferredOuterwearSubtypes: ['jacket', 'coat', 'cardigan', 'blazer'],
    discouragedSubtypes: ['shorts', 'sandals', 'tank_top'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'high',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
  rain: {
    id: 'rain',
    targetFormality: 2,
    allowedFormalityRange: [1, 4],
    preferredStyles: ['casual', 'minimal', 'classic'],
    compatibleStyles: ['business', 'smart_casual'],
    preferredTopSubtypes: ['shirt', 'sweater', 'hoodie'],
    preferredBottomSubtypes: ['jeans', 'trousers', 'joggers'],
    preferredShoeSubtypes: ['boots', 'sneakers', 'loafers'],
    preferredOuterwearSubtypes: ['jacket', 'coat'],
    discouragedSubtypes: ['sandals'],
    hardRejectedSubtypes: [],
    weatherSensitivity: 'high',
    preferOuterwearInCold: true,
    preferOuterwearInRain: true,
  },
}

const quickRequestToProfile: Partial<
  Record<QuickRequestId, OccasionProfileId>
> = {
  university: 'university',
  work: 'work',
  business: 'business',
  wedding: 'formal_event',
  restaurant: 'dinner',
  date: 'date',
  vacation: 'travel',
  cold_weather: 'cold_weather',
  hot_weather: 'hot_weather',
  rain: 'rain',
  old_money: 'business',
  luxury: 'formal_event',
  streetwear: 'streetwear',
  sport: 'sport',
  complete_outfit: 'everyday',
}

function requestText(request?: StylistRequest) {
  return `${request?.message ?? ''} ${request?.quickRequest ?? ''} ${request?.occasion ?? ''}`.toLowerCase()
}

export function resolveOccasionProfile(
  request?: StylistRequest,
): OccasionProfile {
  if (!request) return occasionProfiles.everyday

  const quickProfile = request.quickRequest
    ? quickRequestToProfile[request.quickRequest]
    : null
  if (quickProfile) return occasionProfiles[quickProfile]

  const prompt = requestText(request)
  if (/\b(wedding|formal|gala|ceremony)\b/.test(prompt)) {
    return occasionProfiles.formal_event
  }
  if (/\b(work|office|meeting|business)\b/.test(prompt)) {
    return occasionProfiles.business
  }
  if (/\b(university|campus|class|lecture)\b/.test(prompt)) {
    return occasionProfiles.university
  }
  if (/\b(date|romantic)\b/.test(prompt)) {
    return occasionProfiles.date
  }
  if (/\b(dinner|restaurant)\b/.test(prompt)) {
    return occasionProfiles.dinner
  }
  if (/\b(sport|gym|training|workout)\b/.test(prompt)) {
    return occasionProfiles.sport
  }
  if (/\b(streetwear|oversized)\b/.test(prompt)) {
    return occasionProfiles.streetwear
  }

  return occasionProfiles.everyday
}

export function getSubtypeCompatibilityRules(profile: OccasionProfile) {
  return subtypeCompatibilityRules.filter(
    (rule) =>
      rule.contexts.includes('all') || rule.contexts.includes(profile.id),
  )
}

export function getFormalityLevel(value: string | null | undefined) {
  return getWardrobeFormalityLevel(value)
}

export function isStyleCompatible(left: string, right: string) {
  if (left === right) return true
  return styleCompatibilityGroups.some((group) => {
    const values = group as readonly string[]
    return values.includes(left) && values.includes(right)
  })
}

export function isNeutralColor(color: string) {
  return neutralColors.has(color as WardrobeColorFamily)
}

export function isStrongAccentColor(color: string) {
  return strongAccentColors.has(color as WardrobeColorFamily)
}

export function isEarthColor(color: string) {
  return earthColors.has(color as WardrobeColorFamily)
}

export function areAnalogousColors(left: string, right: string) {
  return analogousColors.some(
    ([first, second]) =>
      (left === first && right === second) ||
      (left === second && right === first),
  )
}

export function areComplementaryColors(left: string, right: string) {
  return complementaryColors.some(
    ([first, second]) =>
      (left === first && right === second) ||
      (left === second && right === first),
  )
}

export function hasStrongWeatherSignal(
  signals: WeatherSuitabilitySignal[],
  signal: WeatherSuitabilitySignal,
) {
  return signals.includes(signal)
}

export function itemMatchesColdWeather(item: StylistWardrobeItem) {
  return (
    (item.warmthLevel ?? 0) >= 3 ||
    item.seasons.includes('winter') ||
    weatherHeavySubtypes.has(item.subtype)
  )
}

export function itemMatchesHotWeather(item: StylistWardrobeItem) {
  return (
    (item.warmthLevel ?? 2) <= 2 &&
    !weatherHeavySubtypes.has(item.subtype) &&
    (item.seasons.includes('summer') ||
      weatherLightSubtypes.has(item.subtype) ||
      item.seasons.length === 0)
  )
}

export function itemHandlesRain(item: StylistWardrobeItem) {
  const haystack = [
    item.material,
    item.subtype,
    item.name,
    item.notes ?? '',
    item.brand,
  ]
    .join(' ')
    .toLowerCase()

  return /rain|water|waterproof|coat|jacket|boots|trench|shell|nylon|polyester/.test(
    haystack,
  )
}

export function getFormalityPenalty(input: {
  target: number
  actual: number
  profile: OccasionProfile
  subtypes: string[]
}) {
  const gap = Math.abs(input.target - input.actual)
  let penalty = 0

  if (gap >= 3) penalty += formalityPenalties.severeGap
  else if (gap === 2) penalty += 5

  if (
    input.profile.id === 'sport' &&
    input.subtypes.some((subtype) =>
      ['dress_shoes', 'heels', 'blazer'].includes(subtype),
    )
  ) {
    penalty += formalityPenalties.sportMismatch
  }

  if (
    (input.profile.id === 'business' || input.profile.id === 'formal_event') &&
    input.subtypes.some((subtype) =>
      ['hoodie', 'sweatshirt', 'sweatpants'].includes(subtype),
    )
  ) {
    penalty += formalityPenalties.formalMismatch
  }

  return penalty
}
