import { z } from 'zod'

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

export function buildPreferenceContext(profile: StylistPreferenceProfile) {
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
    profile.preferredFormality
      ? `Preferred formality: ${profile.preferredFormality}.`
      : '',
    profile.preferredFit ? `Preferred fit: ${profile.preferredFit}.` : '',
  ].filter(Boolean)

  return parts.join(' ')
}
