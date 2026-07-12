import { z } from 'zod'
import type { Locale } from '@/lib/i18n/config'

export const quickRequestIds = [
  'university',
  'work',
  'date',
  'restaurant',
  'wedding',
  'vacation',
  'cold_weather',
  'hot_weather',
  'rain',
  'old_money',
  'luxury',
  'streetwear',
  'sport',
  'business',
  'complete_outfit',
] as const

export type QuickRequestId = (typeof quickRequestIds)[number]

export const stylistRequestSchema = z.object({
  message: z.string().trim().max(800).optional().default(''),
  quickRequest: z.enum(quickRequestIds).optional(),
  locale: z.enum(['az', 'en', 'ru']).default('az'),
  lockedItemIds: z.array(z.string().uuid()).max(8).optional().default([]),
  dateTime: z.string().datetime().optional(),
  occasion: z.string().trim().max(120).optional(),
  locationName: z.string().trim().max(160).optional(),
  weatherContext: z
    .object({
      locationName: z.string().trim().max(160),
      temperatureC: z.number(),
      feelsLikeC: z.number(),
      minTemperatureC: z.number().optional(),
      maxTemperatureC: z.number().optional(),
      precipitationProbability: z.number().min(0).max(100),
      rainMm: z.number().min(0).default(0),
      snowMm: z.number().min(0).default(0),
      windKph: z.number().min(0).default(0),
      humidity: z.number().nullable().optional(),
      uvIndex: z.number().nullable().optional(),
      condition: z.string().trim().max(40),
      time: z.string().datetime(),
      timezone: z.string().trim().max(80),
    })
    .optional(),
  wearHistoryMode: z
    .enum(['include_underused', 'avoid_recently_worn', 'none'])
    .optional()
    .default('none'),
})

export type StylistRequest = z.infer<typeof stylistRequestSchema>

export type StylistWardrobeItem = {
  id: string
  name: string
  category: string
  clothingType: string
  colors: string[]
  seasons: string[]
  styles: string[]
  material: string
  brand: string
  notes: string
  imageUrl: string
}

export const outfitItemSelectionSchema = z.object({
  wardrobeItemId: z.string().uuid(),
  role: z.string().trim().min(1).max(80),
  explanation: z.string().trim().min(1).max(500),
})

export const outfitSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  itemIds: z.array(z.string().uuid()).min(1).max(8),
  explanation: z.string().trim().min(1).max(500),
})

export const stylistOutfitSchema = z.object({
  title: z.string().trim().min(1).max(120),
  occasion: z.string().trim().max(120).default(''),
  styleDirection: z.string().trim().max(80).default(''),
  seasonLabel: z.string().trim().max(80).default(''),
  formalityLabel: z.string().trim().max(80).default(''),
  items: z.array(outfitItemSelectionSchema).min(1).max(8),
  overallExplanation: z.string().trim().min(1).max(1200),
  confidenceScore: z.number().min(0).max(1),
  alternativeSuggestions: z.array(outfitSuggestionSchema).max(3).default([]),
  missingItems: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
})

export type StylistOutfit = z.infer<typeof stylistOutfitSchema>

export const stylistCandidateSchema = stylistOutfitSchema.extend({
  clientCandidateId: z.string().trim().max(120).optional(),
})

export type StylistCandidate = z.infer<typeof stylistCandidateSchema>

export const stylistSuccessResultSchema = z.object({
  status: z.literal('success'),
  outfit: stylistOutfitSchema,
})

export const stylistInsufficientWardrobeResultSchema = z.object({
  status: z.literal('insufficient_wardrobe'),
  message: z.string().trim().min(1).max(1000),
  missingCategories: z.array(z.string().trim().min(1).max(80)).max(8),
  availableCategories: z.array(z.string().trim().min(1).max(80)).max(16),
})

export const stylistResultSchema = z.discriminatedUnion('status', [
  stylistSuccessResultSchema,
  stylistInsufficientWardrobeResultSchema,
])

export const stylistGenerationFailedResultSchema = z.object({
  status: z.literal('generation_failed'),
  message: z.string().trim().min(1).max(1000),
  retryable: z.boolean().default(false),
})

export const stylistBatchSuccessResultSchema = z.object({
  status: z.literal('success'),
  candidates: z.array(stylistCandidateSchema).min(1).max(5),
  limitedVariety: z.boolean().default(false),
  message: z.string().trim().max(1000).default(''),
  metadata: z
    .object({
      providerRequestCount: z.number().int().min(1).default(1),
      retryCount: z.number().int().min(0).default(0),
      modelId: z.string().trim().max(160).optional(),
      promptVersion: z.string().trim().max(120).default('stylist-batch-v1'),
      schemaVersion: z.string().trim().max(120).default('stylist-batch-v1'),
      durationMs: z.number().int().min(0).default(0),
    })
    .default({
      providerRequestCount: 1,
      retryCount: 0,
      promptVersion: 'stylist-batch-v1',
      schemaVersion: 'stylist-batch-v1',
      durationMs: 0,
    }),
})

export const stylistBatchResultSchema = z.discriminatedUnion('status', [
  stylistBatchSuccessResultSchema,
  stylistInsufficientWardrobeResultSchema,
  stylistGenerationFailedResultSchema,
])

export type StylistInsufficientWardrobeResult = z.infer<
  typeof stylistInsufficientWardrobeResultSchema
>
export type StylistResult = z.infer<typeof stylistResultSchema>
export type StylistBatchResult = z.infer<typeof stylistBatchResultSchema>

export type StylistProviderInput = {
  userId: string
  locale: Locale
  request: StylistRequest
  wardrobeItems: StylistWardrobeItem[]
  missingItems: string[]
  strictRetry?: boolean
  candidateCount?: number
  lockedItemIds?: string[]
  preferenceContext?: string
  wearHistoryMode?: 'include_underused' | 'avoid_recently_worn' | 'none'
}

export interface StylistProvider {
  generateOutfit(input: StylistProviderInput): Promise<unknown>
}

export type OutfitDto = {
  id: string
  title: string
  occasion: string
  overallExplanation: string
  confidenceScore: number
  alternativeSuggestions: Array<{
    title: string
    itemIds: string[]
    explanation: string
  }>
  missingItems: string[]
  isSaved: boolean
  isFavorite: boolean
  generationBatchId: string | null
  styleDirection: string
  seasonLabel: string
  formalityLabel: string
  items: Array<{
    wardrobeItemId: string
    role: string
    explanation: string
    item: StylistWardrobeItem | null
  }>
  createdAt: string
}
