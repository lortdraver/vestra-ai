import type { WeatherSuitabilitySignal } from '@/lib/weather'
import type { StylistResolvedPreferenceSignals } from './preferences'
import type {
  StylistCandidateScoreBreakdown,
  StylistValidationIssue,
} from './validation'
import type {
  StylistCandidate,
  StylistRequest,
  StylistWardrobeItem,
} from './types'
import {
  areAnalogousColors,
  areComplementaryColors,
  getFormalityLevel,
  getFormalityPenalty,
  getSubtypeCompatibilityRules,
  hasStrongWeatherSignal,
  isEarthColor,
  isNeutralColor,
  isStrongAccentColor,
  isStyleCompatible,
  itemHandlesRain,
  itemMatchesColdWeather,
  itemMatchesHotWeather,
  resolveOccasionProfile,
  type OccasionProfile,
} from './fashion-rules'

export type CandidateScoringResult = {
  candidateScore: number
  scoreBreakdown: StylistCandidateScoreBreakdown
  rejectionReasons: string[]
  diagnostics: {
    profileId: string
    targetFormality: number
    averageFormality: number
    colorFamilies: string[]
    styleTags: string[]
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function getItemByRole(items: StylistWardrobeItem[], role: string) {
  return items.find((item) => item.role === role)
}

function getColorScore(colorFamilies: string[], profile: OccasionProfile) {
  const uniqueFamilies = unique(colorFamilies)
  if (uniqueFamilies.length === 0) return 5

  let score = 0
  const neutralCount = uniqueFamilies.filter(isNeutralColor).length
  const strongAccentCount = uniqueFamilies.filter(isStrongAccentColor).length
  const earthCount = uniqueFamilies.filter(isEarthColor).length

  if (neutralCount >= 2) score += 8
  if (neutralCount >= 3) score += 3
  if (earthCount >= 2) score += 4

  for (let index = 0; index < uniqueFamilies.length; index += 1) {
    for (
      let nestedIndex = index + 1;
      nestedIndex < uniqueFamilies.length;
      nestedIndex += 1
    ) {
      const left = uniqueFamilies[index]
      const right = uniqueFamilies[nestedIndex]
      if (areAnalogousColors(left, right)) score += 2
      if (areComplementaryColors(left, right)) score += 3
    }
  }

  if (uniqueFamilies.length === 1) score += 8
  if (uniqueFamilies.length === 2) score += 6
  if (uniqueFamilies.length > 4) score -= 5
  if (strongAccentCount >= 3) score -= 8
  if (
    profile.id === 'streetwear' &&
    strongAccentCount === 2 &&
    uniqueFamilies.length <= 3
  ) {
    score += 3
  }

  return clamp(score, -10, 15)
}

function getStyleScore(
  styleTags: string[],
  profile: OccasionProfile,
  preferenceSignals?: StylistResolvedPreferenceSignals | null,
) {
  const uniqueStyles = unique(styleTags)
  if (uniqueStyles.length === 0) return 4

  let score = 0
  const preferredMatches = uniqueStyles.filter((style) =>
    profile.preferredStyles.includes(style),
  ).length
  const compatibleMatches = uniqueStyles.filter((style) =>
    profile.compatibleStyles.includes(style),
  ).length
  score += Math.min(6, preferredMatches * 3)
  score += Math.min(3, compatibleMatches * 1.5)

  let compatiblePairs = 0
  let incompatiblePairs = 0
  for (let index = 0; index < uniqueStyles.length; index += 1) {
    for (
      let nestedIndex = index + 1;
      nestedIndex < uniqueStyles.length;
      nestedIndex += 1
    ) {
      if (isStyleCompatible(uniqueStyles[index], uniqueStyles[nestedIndex])) {
        compatiblePairs += 1
      } else {
        incompatiblePairs += 1
      }
    }
  }

  score += Math.min(3, compatiblePairs)
  score -= Math.min(5, incompatiblePairs * 2)

  if (preferenceSignals) {
    const preferred = uniqueStyles.filter((style) =>
      preferenceSignals.preferredStyles.includes(style),
    ).length
    const avoided = uniqueStyles.filter((style) =>
      preferenceSignals.dislikedStyles.includes(style),
    ).length
    score += Math.min(2, preferred)
    score -= Math.min(4, avoided * 2)
  }

  if (uniqueStyles.length > 4) score -= 3
  return clamp(score, -10, 10)
}

function getSubtypeScore(
  items: StylistWardrobeItem[],
  profile: OccasionProfile,
) {
  let score = 0
  const top = getItemByRole(items, 'top')
  const bottom = getItemByRole(items, 'bottom')
  const shoes = getItemByRole(items, 'shoes')
  const outerwear = getItemByRole(items, 'outerwear')
  const subtypes = items.map((item) => item.subtype)

  if (
    subtypes.some((subtype) => profile.hardRejectedSubtypes.includes(subtype))
  ) {
    return -20
  }

  if (
    subtypes.some((subtype) => profile.discouragedSubtypes.includes(subtype))
  ) {
    score -= 5
  }

  for (const rule of getSubtypeCompatibilityRules(profile)) {
    const matchesTop = !rule.top || (top && rule.top.includes(top.subtype))
    const matchesBottom =
      !rule.bottom || (bottom && rule.bottom.includes(bottom.subtype))
    const matchesShoes =
      !rule.shoes || (shoes && rule.shoes.includes(shoes.subtype))
    const matchesOuterwear =
      !rule.outerwear ||
      !outerwear ||
      rule.outerwear.includes(outerwear.subtype)

    if (matchesTop && matchesBottom && matchesShoes && matchesOuterwear) {
      score += rule.bonus
    }
  }

  const topFit = top?.fit?.toLowerCase() ?? ''
  const bottomFit = bottom?.fit?.toLowerCase() ?? ''
  if (
    topFit.includes('oversized') &&
    (bottomFit.includes('wide') || bottomFit.includes('oversized')) &&
    profile.id !== 'streetwear'
  ) {
    score -= 4
  }
  if (
    (topFit.includes('slim') || topFit.includes('regular')) &&
    (bottomFit.includes('regular') || bottomFit.includes('wide'))
  ) {
    score += 2
  }

  return clamp(score, -20, 15)
}

function getOccasionAndFormalityScore(
  items: StylistWardrobeItem[],
  profile: OccasionProfile,
) {
  const formalityLevels = items.map((item) => getFormalityLevel(item.formality))
  const averageFormality = average(formalityLevels)
  const withinRange =
    averageFormality >= profile.allowedFormalityRange[0] &&
    averageFormality <= profile.allowedFormalityRange[1]

  let occasionMatch = withinRange ? 8 : 4
  const formalityPenalty = getFormalityPenalty({
    target: profile.targetFormality,
    actual: averageFormality,
    profile,
    subtypes: items.map((item) => item.subtype),
  })
  const formalityConsistency = clamp(13 - formalityPenalty, -15, 13)

  const preferredSubtypeMatches = items.filter(
    (item) =>
      profile.preferredTopSubtypes.includes(item.subtype) ||
      profile.preferredBottomSubtypes.includes(item.subtype) ||
      profile.preferredShoeSubtypes.includes(item.subtype) ||
      profile.preferredOuterwearSubtypes.includes(item.subtype),
  ).length
  occasionMatch += Math.min(4, preferredSubtypeMatches)

  return {
    averageFormality,
    occasionMatch: clamp(occasionMatch, 0, 12),
    formalityConsistency,
  }
}

function getWeatherScore(
  items: StylistWardrobeItem[],
  request?: StylistRequest,
  signals: WeatherSuitabilitySignal[] = [],
  profile?: OccasionProfile,
) {
  if (!request?.weatherContext) return 5

  let score = 5
  const hasOuterwear = items.some((item) => item.role === 'outerwear')

  if (hasStrongWeatherSignal(signals, 'hot')) {
    const hotReadyCount = items.filter(itemMatchesHotWeather).length
    score += hotReadyCount >= 2 ? 4 : 1
    if (items.some(itemMatchesColdWeather)) score -= 4
  }

  if (hasStrongWeatherSignal(signals, 'cold')) {
    const coldReadyCount = items.filter(itemMatchesColdWeather).length
    score += coldReadyCount >= 2 ? 4 : 1
    if (
      items.some((item) =>
        ['shorts', 'tank_top', 'sandals'].includes(item.subtype),
      )
    ) {
      score -= 5
    }
    if (profile?.preferOuterwearInCold && !hasOuterwear) score -= 3
  }

  if (
    hasStrongWeatherSignal(signals, 'rain') ||
    hasStrongWeatherSignal(signals, 'snow')
  ) {
    const rainReadyCount = items.filter(itemHandlesRain).length
    score += rainReadyCount >= 1 ? 2 : -2
    if (
      items.some((item) => item.subtype === 'sandals') &&
      !items.some((item) => item.subtype === 'boots')
    ) {
      score -= 4
    }
    if (profile?.preferOuterwearInRain && !hasOuterwear) score -= 2
  }

  if (hasStrongWeatherSignal(signals, 'high_uv')) {
    if (
      items.some((item) => item.subtype === 'cap' || item.subtype === 'hat')
    ) {
      score += 1
    }
  }

  return clamp(score, -10, 10)
}

function getPreferenceScore(
  items: StylistWardrobeItem[],
  request: StylistRequest | undefined,
  preferenceSignals?: StylistResolvedPreferenceSignals | null,
) {
  if (!preferenceSignals) return 0

  let score = 0
  const now = Date.now()

  for (const item of items) {
    if (preferenceSignals.preferredWardrobeItemIds.includes(item.id)) score += 2
    if (preferenceSignals.dislikedWardrobeItemIds.includes(item.id)) score -= 6
    if (preferenceSignals.preferredSubtypes.includes(item.subtype)) score += 2
    if (preferenceSignals.avoidedSubtypes.includes(item.subtype)) score -= 3

    const preferredColorMatches = item.colorFamilies.filter((color) =>
      preferenceSignals.preferredColors.includes(color),
    ).length
    const avoidedColorMatches = item.colorFamilies.filter((color) =>
      preferenceSignals.avoidedColors.includes(color),
    ).length
    score += Math.min(2, preferredColorMatches)
    score -= Math.min(3, avoidedColorMatches * 2)

    const preferredStyleMatches = item.styleTags.filter((style) =>
      preferenceSignals.preferredStyles.includes(style),
    ).length
    const dislikedStyleMatches = item.styleTags.filter((style) =>
      preferenceSignals.dislikedStyles.includes(style),
    ).length
    score += Math.min(2, preferredStyleMatches)
    score -= Math.min(3, dislikedStyleMatches * 2)

    if (item.lastWornAt && request?.wearHistoryMode !== 'none') {
      const daysSinceWorn =
        (now - new Date(item.lastWornAt).getTime()) / 86_400_000
      if (request?.wearHistoryMode === 'avoid_recently_worn') {
        if (daysSinceWorn <= 7) score -= 3
        else if (daysSinceWorn >= 30) score += 1
      }
    }

    if ((item.wearCount ?? 0) === 0) score += 1
  }

  return clamp(score, -10, 10)
}

function computeDiversityPenalty(
  candidate: StylistCandidate,
  acceptedCandidates: StylistCandidate[],
  itemById: Map<string, StylistWardrobeItem>,
) {
  if (acceptedCandidates.length === 0) return 0

  let penalty = 0
  const candidateIds = new Set(
    candidate.items.map((item) => item.wardrobeItemId),
  )
  const candidateSubtypes = candidate.items
    .map((item) => itemById.get(item.wardrobeItemId)?.subtype ?? '')
    .filter(Boolean)
    .join('|')

  for (const accepted of acceptedCandidates) {
    const acceptedIds = new Set(
      accepted.items.map((item) => item.wardrobeItemId),
    )
    const shared = [...candidateIds].filter((id) => acceptedIds.has(id)).length
    const overlap = shared / Math.max(candidateIds.size, acceptedIds.size, 1)
    if (overlap >= 0.9) penalty -= 12
    else if (overlap >= 0.75) penalty -= 7
    else if (overlap >= 0.5) penalty -= 3

    const acceptedSubtypes = accepted.items
      .map((item) => itemById.get(item.wardrobeItemId)?.subtype ?? '')
      .filter(Boolean)
      .join('|')
    if (
      candidateSubtypes &&
      acceptedSubtypes &&
      candidateSubtypes === acceptedSubtypes
    ) {
      penalty -= 3
    }
  }

  return clamp(penalty, -12, 0)
}

export function scoreStylistCandidate(input: {
  candidate: StylistCandidate
  selectedItems: StylistWardrobeItem[]
  request?: StylistRequest
  preferenceSignals?: StylistResolvedPreferenceSignals | null
  weatherSignals?: WeatherSuitabilitySignal[]
  acceptedCandidates?: StylistCandidate[]
}): CandidateScoringResult {
  const profile = resolveOccasionProfile(input.request)
  const itemById = new Map(input.selectedItems.map((item) => [item.id, item]))
  const colorFamilies = input.selectedItems.flatMap(
    (item) => item.colorFamilies,
  )
  const styleTags = input.selectedItems.flatMap((item) => item.styleTags)
  const formality = getOccasionAndFormalityScore(input.selectedItems, profile)

  const scoreBreakdown: StylistCandidateScoreBreakdown = {
    completeness: input.selectedItems.length > 0 ? 15 : 0,
    occasionMatch: formality.occasionMatch,
    subtypeCompatibility: getSubtypeScore(input.selectedItems, profile),
    formalityConsistency: formality.formalityConsistency,
    weatherSeason: getWeatherScore(
      input.selectedItems,
      input.request,
      input.weatherSignals,
      profile,
    ),
    colorCompatibility: getColorScore(colorFamilies, profile),
    styleConsistency: getStyleScore(
      styleTags,
      profile,
      input.preferenceSignals,
    ),
    preferenceMatch: getPreferenceScore(
      input.selectedItems,
      input.request,
      input.preferenceSignals,
    ),
    duplicatePenalty: computeDiversityPenalty(
      input.candidate,
      input.acceptedCandidates ?? [],
      itemById,
    ),
  }

  const rejectionReasons: string[] = []
  if (scoreBreakdown.subtypeCompatibility <= -15) {
    rejectionReasons.push(`occasion_violation:${profile.id}`)
  }
  if (scoreBreakdown.formalityConsistency <= -8) {
    rejectionReasons.push('formality_mismatch')
  }
  if (scoreBreakdown.colorCompatibility <= -6) {
    rejectionReasons.push('poor_color_harmony')
  }

  const candidateScore = clamp(
    scoreBreakdown.completeness +
      scoreBreakdown.occasionMatch +
      scoreBreakdown.subtypeCompatibility +
      scoreBreakdown.formalityConsistency +
      scoreBreakdown.weatherSeason +
      scoreBreakdown.colorCompatibility +
      scoreBreakdown.styleConsistency +
      scoreBreakdown.preferenceMatch +
      scoreBreakdown.duplicatePenalty,
    0,
    100,
  )

  return {
    candidateScore,
    scoreBreakdown,
    rejectionReasons,
    diagnostics: {
      profileId: profile.id,
      targetFormality: profile.targetFormality,
      averageFormality: formality.averageFormality,
      colorFamilies: unique(colorFamilies),
      styleTags: unique(styleTags),
    },
  }
}

export function getCandidateScoreValidationIssues(
  result: CandidateScoringResult,
  minimumScore: number,
): StylistValidationIssue[] {
  const issues: StylistValidationIssue[] = []

  if (result.candidateScore < minimumScore) {
    issues.push({
      path: ['candidateScore'],
      code: 'too_small',
      message: `Candidate score ${result.candidateScore} is below minimum ${minimumScore}.`,
    })
  }

  for (const reason of result.rejectionReasons) {
    issues.push({
      path: ['candidateScore'],
      code: 'custom',
      message: reason,
    })
  }

  return issues
}
