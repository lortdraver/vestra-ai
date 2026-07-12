import {
  analysisFieldKeys,
  clothingAnalysisSchema,
  type ClothingAnalysis,
} from './analysis-schema'
import type { AnalyzeClothingInput } from './provider'

const lowConfidenceThreshold = 0.6

const topTypePattern =
  /\b(t[\s-]?shirt|tee|shirt|blouse|polo|sweater|hoodie|tank)\b/i

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value))
}

function detectClothingType(
  input: AnalyzeClothingInput,
  analysis: ClothingAnalysis,
) {
  const text = `${input.name} ${input.clothingType} ${analysis.detectedClothingType} ${analysis.visualDescription}`

  if (/\b(t[\s-]?shirt|tee)\b/i.test(text)) return 't-shirt'
  if (/\bpolo\b/i.test(text)) return 'polo shirt'
  if (/\bhoodie\b/i.test(text)) return 'hoodie'
  if (/\bsweater\b/i.test(text)) return 'sweater'
  if (/\bshirt\b/i.test(text)) return 'shirt'

  return analysis.detectedClothingType
}

function detectCategory(clothingType: string, analysis: ClothingAnalysis) {
  if (topTypePattern.test(clothingType)) return 'tops'
  return analysis.detectedCategory
}

function detectBrand(input: AnalyzeClothingInput, analysis: ClothingAnalysis) {
  const text = `${input.name} ${input.clothingType} ${analysis.brandGuess} ${analysis.visualDescription}`

  if (/\blevi'?s\b/i.test(text)) return "Levi's"
  if (/\bnike\b/i.test(text)) return 'Nike'
  if (/\badidas\b/i.test(text)) return 'Adidas'
  if (/\bzara\b/i.test(text)) return 'Zara'
  if (/\bh&m\b/i.test(text)) return 'H&M'

  return analysis.brandGuess
}

function inferMaterial(
  input: AnalyzeClothingInput,
  analysis: ClothingAnalysis,
) {
  const text = `${input.name} ${input.clothingType} ${analysis.visualDescription}`
  if (/\bt[\s-]?shirt\b|\btee\b/i.test(text) && !analysis.material) {
    return 'cotton blend'
  }
  return analysis.material
}

function buildFieldConfidences(
  analysis: ClothingAnalysis,
  deterministic: Partial<Record<(typeof analysisFieldKeys)[number], number>>,
) {
  const fieldConfidences = { ...analysis.fieldConfidences }

  for (const key of analysisFieldKeys) {
    fieldConfidences[key] = clampConfidence(
      deterministic[key] ?? fieldConfidences[key] ?? analysis.confidenceScore,
    )
  }

  return fieldConfidences
}

export function enhanceClothingAnalysis(
  analysis: ClothingAnalysis,
  input: AnalyzeClothingInput,
): ClothingAnalysis {
  const hintedColors = input.imageColorHints?.colors ?? []
  const hintedHexColors = input.imageColorHints?.dominantHexColors ?? []
  const detectedClothingType = detectClothingType(input, analysis)
  const detectedCategory = detectCategory(detectedClothingType, analysis)
  const brandGuess = detectBrand(input, analysis)
  const material = inferMaterial(input, analysis)
  const colors = hintedColors.length
    ? hintedColors
    : unique([...(input.colors ?? []), ...analysis.colors])
  const dominantHexColors = hintedHexColors.length
    ? hintedHexColors
    : analysis.dominantHexColors
  const deterministicConfidences: Partial<
    Record<(typeof analysisFieldKeys)[number], number>
  > = {}

  if (detectedClothingType !== analysis.detectedClothingType) {
    deterministicConfidences.detectedClothingType = 0.9
  }
  if (detectedCategory !== analysis.detectedCategory) {
    deterministicConfidences.detectedCategory = 0.9
  }
  if (hintedColors.length) deterministicConfidences.colors = 0.88
  if (hintedHexColors.length) deterministicConfidences.dominantHexColors = 0.88
  if (brandGuess && brandGuess !== analysis.brandGuess) {
    deterministicConfidences.brandGuess = 0.82
  }

  const fieldConfidences = buildFieldConfidences(
    analysis,
    deterministicConfidences,
  )
  const needsReviewFields = analysisFieldKeys.filter(
    (field) => (fieldConfidences[field] ?? 0) < lowConfidenceThreshold,
  )

  return clothingAnalysisSchema.parse({
    ...analysis,
    detectedClothingType,
    detectedCategory,
    colors,
    dominantHexColors,
    material,
    brandGuess,
    fieldConfidences,
    needsReviewFields,
    promptVersion: 'clothing-analysis-v2',
  })
}
