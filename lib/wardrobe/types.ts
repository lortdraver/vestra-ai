import type {
  AnalysisStatus,
  ClothingAnalysis,
  ClothingAnalysisCorrections,
} from '@/lib/ai/analysis-schema'

export type WardrobeItemDto = {
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
  imageContentType: string
  imageSize: number
  originalImageUrl: string
  originalImageContentType: string
  originalImageSize: number
  processedImageUrl: string
  processedImageContentType: string
  processedImageSize: number
  backgroundRemovalStatus: string
  backgroundRemovalProvider: string | null
  backgroundRemovalModelId: string | null
  analysisStatus: AnalysisStatus
  aiAnalysis: ClothingAnalysis | null
  userCorrections: ClothingAnalysisCorrections | null
  effectiveAnalysis: (ClothingAnalysis & ClothingAnalysisCorrections) | null
  analysisError: string | null
  analysisPromptVersion: string | null
  analysisModelId: string | null
  analyzedAt: string | null
  lastWornAt: string | null
  wearCount: number
  neverWorn: boolean
  unusedDays: number | null
  longUnusedStatus: '30' | '60' | '90' | null
  createdAt: string
  updatedAt: string
}

export type WardrobeItemPayload = {
  name: string
  category: string
  clothingType: string
  colors: string[]
  seasons: string[]
  styles: string[]
  material: string
  brand: string
  notes: string
  imageColorHints?: {
    colors: string[]
    dominantHexColors: string[]
  } | null
}
