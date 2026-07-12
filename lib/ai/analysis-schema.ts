import { z } from 'zod'
import {
  wardrobeCategories,
  wardrobeSeasons,
  wardrobeStyles,
} from '@/lib/wardrobe/constants'

export const analysisStatuses = [
  'pending',
  'analyzing',
  'done',
  'failed',
] as const

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase())

export const analysisFieldKeys = [
  'detectedClothingType',
  'detectedCategory',
  'colors',
  'dominantHexColors',
  'material',
  'season',
  'style',
  'fit',
  'pattern',
  'warmthLevel',
  'formalityLevel',
  'brandGuess',
  'visualDescription',
] as const

const fieldConfidenceSchema = z.partialRecord(
  z.enum(analysisFieldKeys),
  z.number().min(0).max(1),
)

export const clothingAnalysisSchema = z.object({
  detectedClothingType: z.string().trim().min(1).max(80),
  detectedCategory: z.enum(wardrobeCategories),
  colors: z.array(z.string().trim().min(1).max(40)).max(12),
  dominantHexColors: z.array(hexColorSchema).max(8),
  material: z.string().trim().max(80).default(''),
  season: z.array(z.enum(wardrobeSeasons)).max(4),
  style: z.array(z.enum(wardrobeStyles)).max(9),
  fit: z.string().trim().max(80).default(''),
  pattern: z.string().trim().max(80).default(''),
  warmthLevel: z.number().int().min(1).max(5),
  formalityLevel: z.number().int().min(1).max(5),
  brandGuess: z.string().trim().max(80).default(''),
  confidenceScore: z.number().min(0).max(1),
  fieldConfidences: fieldConfidenceSchema.default({}),
  needsReviewFields: z.array(z.enum(analysisFieldKeys)).max(20).default([]),
  visualDescription: z.string().trim().min(1).max(1_000),
  promptVersion: z.string().trim().min(1).max(40),
  modelId: z.string().trim().min(1).max(120),
})

export const clothingAnalysisCorrectionsSchema = clothingAnalysisSchema
  .omit({
    promptVersion: true,
    modelId: true,
    fieldConfidences: true,
    needsReviewFields: true,
  })
  .partial()

export type AnalysisStatus = (typeof analysisStatuses)[number]
export type ClothingAnalysis = z.infer<typeof clothingAnalysisSchema>
export type ClothingAnalysisCorrections = z.infer<
  typeof clothingAnalysisCorrectionsSchema
>

export function parseClothingAnalysis(value: unknown): ClothingAnalysis {
  return clothingAnalysisSchema.parse(value)
}

export function parseAnalysisCorrections(
  value: unknown,
): ClothingAnalysisCorrections {
  return clothingAnalysisCorrectionsSchema.parse(value)
}

export function mergeAnalysisCorrections(
  analysis: ClothingAnalysis | null,
  corrections: ClothingAnalysisCorrections | null,
) {
  if (!analysis) return null
  return { ...analysis, ...(corrections ?? {}) }
}
