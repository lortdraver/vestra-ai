import type { outfit, outfitItem } from '@/lib/db/schema'
import type { OutfitDto, StylistWardrobeItem } from './types'

type OutfitRow = typeof outfit.$inferSelect
type OutfitItemRow = typeof outfitItem.$inferSelect

export function toOutfitDto(
  row: OutfitRow,
  items: OutfitItemRow[],
  wardrobeById: Map<string, StylistWardrobeItem>,
): OutfitDto {
  return {
    id: row.id,
    title: row.title,
    occasion: row.occasion,
    overallExplanation: row.overallExplanation,
    confidenceScore: Number(row.confidenceScore),
    alternativeSuggestions: row.alternativeSuggestions,
    missingItems: row.missingItems,
    isSaved: row.isSaved,
    isFavorite: row.isFavorite,
    generationBatchId: row.generationBatchId,
    styleDirection: row.styleDirection,
    seasonLabel: row.seasonLabel,
    formalityLabel: row.formalityLabel,
    items: items
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((item) => ({
        wardrobeItemId: item.wardrobeItemId,
        role: item.role,
        explanation: item.explanation,
        item: wardrobeById.get(item.wardrobeItemId) ?? null,
      })),
    createdAt: row.createdAt.toISOString(),
  }
}
