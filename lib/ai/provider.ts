import type { ClothingAnalysis } from './analysis-schema'

export type AnalyzeClothingInput = {
  itemId: string
  userId: string
  imageUrl: string
  imageDataUrl?: string
  name: string
  category: string
  clothingType: string
  colors?: string[]
  imageColorHints?: {
    colors: string[]
    dominantHexColors: string[]
  } | null
}

export interface ClothingAnalysisProvider {
  analyzeClothing(input: AnalyzeClothingInput): Promise<ClothingAnalysis>
}
