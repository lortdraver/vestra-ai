import type { OutfitDto } from '@/lib/stylist'

export type OutfitDeleteScope = 'saved' | 'history'

export function removeOutfitFromCollection(
  outfits: OutfitDto[],
  outfitId: string,
) {
  return outfits.filter((outfit) => outfit.id !== outfitId)
}

export function getOutfitDeleteScope(input: {
  view: 'saved' | 'history' | 'generated'
  isSaved: boolean
}): OutfitDeleteScope {
  if (input.view === 'saved' || input.isSaved) {
    return 'saved'
  }

  return 'history'
}
