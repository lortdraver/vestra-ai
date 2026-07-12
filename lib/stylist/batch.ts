import type {
  StylistBatchResult,
  StylistOutfit,
  StylistRequest,
  StylistWardrobeItem,
} from './types'

const styleDirections = [
  'minimal',
  'relaxed',
  'elevated',
  'classic',
  'smart casual',
] as const

function byCategory(items: StylistWardrobeItem[], category: string) {
  return items.filter((item) => item.category === category)
}

function explanation(item: StylistWardrobeItem) {
  return `${item.name} supports the outfit through its ${item.category} role.`
}

export function buildLocalCandidateBatch({
  baseOutfit,
  wardrobeItems,
  request,
  candidateCount = 3,
  lockedItemIds = [],
}: {
  baseOutfit: StylistOutfit
  wardrobeItems: StylistWardrobeItem[]
  request: StylistRequest
  candidateCount?: number
  lockedItemIds?: string[]
}): StylistBatchResult {
  const tops = byCategory(wardrobeItems, 'tops')
  const bottoms = byCategory(wardrobeItems, 'bottoms')
  const shoes = byCategory(wardrobeItems, 'shoes')
  const accessories = [
    ...byCategory(wardrobeItems, 'outerwear'),
    ...byCategory(wardrobeItems, 'accessories'),
  ]
  const target = Math.min(Math.max(candidateCount, 1), 5)
  const candidates: StylistOutfit[] = []
  const lockedItems = wardrobeItems.filter((item) =>
    lockedItemIds.includes(item.id),
  )

  for (let index = 0; index < target; index += 1) {
    const selected = [
      ...lockedItems,
      tops[index % Math.max(tops.length, 1)],
      bottoms[index % Math.max(bottoms.length, 1)],
      shoes[index % Math.max(shoes.length, 1)],
      accessories[index % Math.max(accessories.length, 1)],
    ].filter(Boolean) as StylistWardrobeItem[]
    const uniqueSelected = selected.filter(
      (item, itemIndex) =>
        selected.findIndex((entry) => entry.id === item.id) === itemIndex,
    )

    if (uniqueSelected.length === 0) continue

    candidates.push({
      ...baseOutfit,
      title:
        index === 0
          ? baseOutfit.title
          : `${baseOutfit.title} ${String(index + 1)}`,
      occasion: request.quickRequest ?? baseOutfit.occasion,
      styleDirection: styleDirections[index % styleDirections.length],
      seasonLabel: uniqueSelected.flatMap((item) => item.seasons)[0] ?? '',
      formalityLabel: request.quickRequest === 'business' ? 'business' : '',
      items: uniqueSelected.map((item) => ({
        wardrobeItemId: item.id,
        role: item.category,
        explanation: explanation(item),
      })),
      overallExplanation:
        index === 0
          ? baseOutfit.overallExplanation
          : `${baseOutfit.overallExplanation} This option changes the balance with a ${styleDirections[index % styleDirections.length]} direction.`,
      confidenceScore: Math.max(
        0.65,
        baseOutfit.confidenceScore - index * 0.03,
      ),
      alternativeSuggestions: [],
      missingItems: [],
    })
  }

  return {
    status: 'success',
    candidates,
    limitedVariety: candidates.length < target,
    message:
      candidates.length < target
        ? 'Wardrobe variety is limited, so fewer distinct options are available.'
        : '',
    metadata: {
      providerRequestCount: 1,
      retryCount: 0,
      promptVersion: 'stylist-batch-v1',
      schemaVersion: 'stylist-batch-v1',
      durationMs: 0,
    },
  }
}
