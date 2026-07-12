import { wardrobeCategories } from '@/lib/wardrobe/constants'
import { clothingAnalysisSchema } from './analysis-schema'
import type { ClothingAnalysisProvider } from './provider'

export class MockClothingAnalysisProvider implements ClothingAnalysisProvider {
  async analyzeClothing(
    input: Parameters<ClothingAnalysisProvider['analyzeClothing']>[0],
  ) {
    const detectedCategory = wardrobeCategories.includes(
      input.category as never,
    )
      ? input.category
      : 'other'

    return clothingAnalysisSchema.parse({
      detectedClothingType: input.clothingType || 'shirt',
      detectedCategory,
      colors: input.imageColorHints?.colors.length
        ? input.imageColorHints.colors
        : input.colors?.length
          ? input.colors
          : ['grey'],
      dominantHexColors: input.imageColorHints?.dominantHexColors.length
        ? input.imageColorHints.dominantHexColors
        : ['#8a8a8a'],
      material: 'cotton',
      season: ['spring', 'autumn'],
      style: ['casual', 'classic'],
      fit: 'regular',
      pattern: 'solid',
      warmthLevel: 2,
      formalityLevel: 3,
      brandGuess: '',
      confidenceScore: 0.82,
      fieldConfidences: {
        detectedClothingType: 0.7,
        detectedCategory: 0.7,
        colors: input.imageColorHints?.colors.length ? 0.88 : 0.55,
        dominantHexColors: input.imageColorHints?.dominantHexColors.length
          ? 0.88
          : 0.55,
        material: 0.62,
        season: 0.68,
        style: 0.68,
        fit: 0.55,
        pattern: 0.62,
        warmthLevel: 0.6,
        formalityLevel: 0.6,
        brandGuess: 0.35,
        visualDescription: 0.6,
      },
      needsReviewFields: input.imageColorHints?.colors.length
        ? ['fit', 'brandGuess']
        : ['colors', 'dominantHexColors', 'fit', 'brandGuess'],
      visualDescription:
        'Development mock analysis for a clean clothing item image.',
      promptVersion: 'clothing-analysis-v2',
      modelId: 'mock-clothing-vision-v1',
    })
  }
}
