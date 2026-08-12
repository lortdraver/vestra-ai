import { z } from 'zod'
import type { StylistWardrobeItem } from './types'

export const stylistPreferenceSchema = z.object({
  preferredStyles: z
    .array(z.string().trim().min(1).max(80))
    .max(20)
    .default([]),
  dislikedStyles: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  preferredColors: z
    .array(z.string().trim().min(1).max(80))
    .max(20)
    .default([]),
  avoidedColors: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  preferredFormality: z.string().trim().max(80).default(''),
  preferredFit: z.string().trim().max(80).default(''),
  preferredWardrobeItemIds: z.array(z.string().uuid()).max(50).default([]),
  dislikedWardrobeItemIds: z.array(z.string().uuid()).max(50).default([]),
})

export const stylistPreferencePatchSchema = stylistPreferenceSchema.partial()

export type StylistPreferenceProfile = z.infer<typeof stylistPreferenceSchema>
export type StylistLearnedPreferenceSignals = {
  preferredStyles: string[]
  dislikedStyles: string[]
  preferredColors: string[]
  avoidedColors: string[]
  preferredSubtypes: string[]
  avoidedSubtypes: string[]
  preferredWardrobeItemIds: string[]
  dislikedWardrobeItemIds: string[]
}

export type StylistResolvedPreferenceSignals = StylistPreferenceProfile & {
  preferredSubtypes: string[]
  avoidedSubtypes: string[]
}

function unique(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  )
}

function countTop(values: string[], limit = 6, minimumCount = 1) {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1
    return accumulator
  }, {})

  return Object.entries(counts)
    .filter(([, count]) => count >= minimumCount)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, limit)
    .map(([value]) => value)
}

export type StylistPreferenceLearningOutfit = {
  isFavorite: boolean
  isSaved: boolean
  items: StylistWardrobeItem[]
}

export type StylistPreferenceLearningFeedback = {
  rating: string
  reasonTags: string[]
  items: StylistWardrobeItem[]
}

export function mergePreferenceSignals(
  profile: StylistPreferenceProfile,
  learnedSignals?: Partial<StylistLearnedPreferenceSignals> | null,
): StylistResolvedPreferenceSignals {
  return {
    preferredStyles: unique([
      ...profile.preferredStyles,
      ...(learnedSignals?.preferredStyles ?? []),
    ]),
    dislikedStyles: unique([
      ...profile.dislikedStyles,
      ...(learnedSignals?.dislikedStyles ?? []),
    ]),
    preferredColors: unique([
      ...profile.preferredColors,
      ...(learnedSignals?.preferredColors ?? []),
    ]),
    avoidedColors: unique([
      ...profile.avoidedColors,
      ...(learnedSignals?.avoidedColors ?? []),
    ]),
    preferredWardrobeItemIds: unique([
      ...profile.preferredWardrobeItemIds,
      ...(learnedSignals?.preferredWardrobeItemIds ?? []),
    ]),
    dislikedWardrobeItemIds: unique([
      ...profile.dislikedWardrobeItemIds,
      ...(learnedSignals?.dislikedWardrobeItemIds ?? []),
    ]),
    preferredSubtypes: unique(learnedSignals?.preferredSubtypes ?? []),
    avoidedSubtypes: unique(learnedSignals?.avoidedSubtypes ?? []),
    preferredFormality: profile.preferredFormality,
    preferredFit: profile.preferredFit,
  }
}

export function deriveLearnedPreferenceSignals(input: {
  outfits: StylistPreferenceLearningOutfit[]
  feedback: StylistPreferenceLearningFeedback[]
}): StylistLearnedPreferenceSignals {
  const positiveItems = input.outfits
    .filter((outfit) => outfit.isFavorite || outfit.isSaved)
    .flatMap((outfit) => outfit.items)
  const positiveFeedbackItems = input.feedback
    .filter((entry) =>
      ['like', 'good_combination', 'save_as_preference'].includes(entry.rating),
    )
    .flatMap((entry) => entry.items)
  const negativeFeedbackItems = input.feedback
    .filter((entry) =>
      ['dislike', 'not_my_style', 'colors_do_not_work'].includes(entry.rating),
    )
    .flatMap((entry) => entry.items)
  const explicitDislikedItems = input.feedback
    .filter((entry) => entry.rating === 'do_not_like_this_item')
    .flatMap((entry) => entry.items)

  const allPositiveItems = [...positiveItems, ...positiveFeedbackItems]
  const allNegativeItems = [...negativeFeedbackItems, ...explicitDislikedItems]

  return {
    preferredStyles: countTop(
      allPositiveItems.flatMap((item) => item.styleTags),
      6,
      1,
    ),
    dislikedStyles: countTop(
      allNegativeItems.flatMap((item) => item.styleTags),
      4,
      2,
    ),
    preferredColors: countTop(
      allPositiveItems.flatMap((item) => item.colorFamilies),
      6,
      1,
    ),
    avoidedColors: countTop(
      allNegativeItems.flatMap((item) => item.colorFamilies),
      4,
      2,
    ),
    preferredSubtypes: countTop(
      allPositiveItems.map((item) => item.subtype),
      6,
      1,
    ),
    avoidedSubtypes: countTop(
      allNegativeItems.map((item) => item.subtype),
      4,
      2,
    ),
    preferredWardrobeItemIds: unique(allPositiveItems.map((item) => item.id)),
    dislikedWardrobeItemIds: unique([
      ...explicitDislikedItems.map((item) => item.id),
    ]),
  }
}

export function buildPreferenceContext(
  profile: StylistPreferenceProfile | StylistResolvedPreferenceSignals,
) {
  const preferredSubtypes =
    'preferredSubtypes' in profile ? profile.preferredSubtypes : []
  const avoidedSubtypes =
    'avoidedSubtypes' in profile ? profile.avoidedSubtypes : []
  const parts = [
    profile.preferredStyles.length
      ? `Preferred styles: ${profile.preferredStyles.join(', ')}.`
      : '',
    profile.dislikedStyles.length
      ? `Avoid styles: ${profile.dislikedStyles.join(', ')}.`
      : '',
    profile.preferredColors.length
      ? `Preferred colors: ${profile.preferredColors.join(', ')}.`
      : '',
    profile.avoidedColors.length
      ? `Avoid colors: ${profile.avoidedColors.join(', ')}.`
      : '',
    preferredSubtypes.length
      ? `Preferred clothing subtypes: ${preferredSubtypes.join(', ')}.`
      : '',
    avoidedSubtypes.length
      ? `Avoid clothing subtypes: ${avoidedSubtypes.join(', ')}.`
      : '',
    profile.preferredFormality
      ? `Preferred formality: ${profile.preferredFormality}.`
      : '',
    profile.preferredFit ? `Preferred fit: ${profile.preferredFit}.` : '',
    profile.preferredWardrobeItemIds.length
      ? `Previously liked wardrobe items are available in the shortlist.`
      : '',
    profile.dislikedWardrobeItemIds.length
      ? `Avoid wardrobe items the user previously disliked unless they are explicitly locked.`
      : '',
  ].filter(Boolean)

  return parts.join(' ')
}
