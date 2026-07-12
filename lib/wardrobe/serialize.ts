import type { wardrobeItem } from '@/lib/db/schema'
import {
  analysisStatuses,
  mergeAnalysisCorrections,
  parseAnalysisCorrections,
  parseClothingAnalysis,
  type AnalysisStatus,
} from '@/lib/ai/analysis-schema'
import type { WardrobeItemDto } from './types'

type WardrobeItemRow = typeof wardrobeItem.$inferSelect
type WearStats = { totalWearCount: number; lastWornAt: string | null }

function getUnusedSummary(lastWornAt: string | null) {
  if (!lastWornAt) {
    return { unusedDays: null, longUnusedStatus: null }
  }

  const unusedDays = Math.floor(
    (Date.now() - new Date(lastWornAt).getTime()) / 86_400_000,
  )
  const longUnusedStatus: '30' | '60' | '90' | null =
    unusedDays >= 90
      ? '90'
      : unusedDays >= 60
        ? '60'
        : unusedDays >= 30
          ? '30'
          : null

  return { unusedDays, longUnusedStatus }
}

export function toWardrobeItemDto(
  item: WardrobeItemRow,
  wearStats?: WearStats,
): WardrobeItemDto {
  const analysisStatus = analysisStatuses.includes(
    item.analysisStatus as AnalysisStatus,
  )
    ? (item.analysisStatus as AnalysisStatus)
    : 'pending'
  const aiAnalysis = item.aiAnalysis
    ? parseClothingAnalysis(item.aiAnalysis)
    : null
  const userCorrections = item.userCorrections
    ? parseAnalysisCorrections(item.userCorrections)
    : null
  const lastWornAt = wearStats?.lastWornAt ?? null
  const wearCount = wearStats?.totalWearCount ?? 0
  const unusedSummary = getUnusedSummary(lastWornAt)

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    clothingType: item.clothingType,
    colors: item.colors,
    seasons: item.seasons,
    styles: item.styles,
    material: item.material,
    brand: item.brand,
    notes: item.notes,
    imageUrl: item.processedImageUrl ?? item.imageUrl,
    imageContentType: item.imageContentType,
    imageSize: Number(item.imageSize),
    originalImageUrl: item.originalImageUrl ?? item.imageUrl,
    originalImageContentType:
      item.originalImageContentType ?? item.imageContentType,
    originalImageSize: Number(item.originalImageSize ?? item.imageSize),
    processedImageUrl: item.processedImageUrl ?? item.imageUrl,
    processedImageContentType:
      item.processedImageContentType ?? item.imageContentType,
    processedImageSize: Number(item.processedImageSize ?? item.imageSize),
    backgroundRemovalStatus: item.backgroundRemovalStatus,
    backgroundRemovalProvider: item.backgroundRemovalProvider,
    backgroundRemovalModelId: item.backgroundRemovalModelId,
    analysisStatus,
    aiAnalysis,
    userCorrections,
    effectiveAnalysis: mergeAnalysisCorrections(aiAnalysis, userCorrections),
    analysisError: item.analysisError,
    analysisPromptVersion: item.analysisPromptVersion,
    analysisModelId: item.analysisModelId,
    analyzedAt: item.analyzedAt?.toISOString() ?? null,
    lastWornAt,
    wearCount,
    neverWorn: wearCount === 0,
    unusedDays: unusedSummary.unusedDays,
    longUnusedStatus: unusedSummary.longUnusedStatus,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}
