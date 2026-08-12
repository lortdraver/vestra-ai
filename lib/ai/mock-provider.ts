import { clothingAnalysisSchema } from './analysis-schema'
import type { ClothingAnalysisProvider } from './provider'
import { resolveWardrobeTaxonomy } from '@/lib/wardrobe/taxonomy'

export class MockClothingAnalysisProvider implements ClothingAnalysisProvider {
  async analyzeClothing(
    input: Parameters<ClothingAnalysisProvider['analyzeClothing']>[0],
  ) {
    const taxonomy = resolveWardrobeTaxonomy({
      category: input.category,
      clothingType: input.clothingType,
    })

    return clothingAnalysisSchema.parse({
      role: taxonomy.role,
      subtype: taxonomy.subtype,
      colors: input.imageColorHints?.colors.length
        ? input.imageColorHints.colors
        : input.colors?.length
          ? input.colors
          : ['gray'],
      colorFamilies: input.imageColorHints?.colors.length ? ['gray'] : ['gray'],
      dominantHexColors: input.imageColorHints?.dominantHexColors.length
        ? input.imageColorHints.dominantHexColors
        : ['#8a8a8a'],
      material: 'cotton',
      season: ['spring', 'autumn'],
      styleTags: ['casual', 'classic'],
      fit: 'regular',
      pattern: 'solid',
      warmthLevel: 2,
      formality: 'casual',
      formalityLevel: 2,
      brandGuess: '',
      confidenceScore: 0.82,
      fieldConfidences: {
        role: 0.74,
        subtype: 0.74,
        colors: input.imageColorHints?.colors.length ? 0.88 : 0.55,
        colorFamilies: input.imageColorHints?.colors.length ? 0.82 : 0.55,
        dominantHexColors: input.imageColorHints?.dominantHexColors.length
          ? 0.88
          : 0.55,
        material: 0.62,
        season: 0.68,
        styleTags: 0.68,
        fit: 0.55,
        pattern: 0.62,
        warmthLevel: 0.6,
        formality: 0.6,
        formalityLevel: 0.6,
        brandGuess: 0.35,
        visualDescription: 0.6,
      },
      needsReviewFields: input.imageColorHints?.colors.length
        ? ['fit', 'brandGuess']
        : ['colors', 'dominantHexColors', 'fit', 'brandGuess'],
      visualDescription:
        'Development mock analysis for a clean clothing item image.',
      promptVersion: 'clothing-analysis-v3',
      modelId: 'mock-clothing-vision-v1',
    })
  }
}
