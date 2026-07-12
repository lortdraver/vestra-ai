export const wardrobeCategories = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'accessories',
  'bags',
  'underwear',
  'activewear',
  'other',
] as const

export const wardrobeSeasons = ['spring', 'summer', 'autumn', 'winter'] as const

export const wardrobeStyles = [
  'casual',
  'formal',
  'business',
  'streetwear',
  'classic',
  'minimal',
  'sport',
  'evening',
  'other',
] as const

export const acceptedImageTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const
export const maxUploadedImageBytes = 2_500_000

export type WardrobeCategory = (typeof wardrobeCategories)[number]
export type WardrobeSeason = (typeof wardrobeSeasons)[number]
export type WardrobeStyle = (typeof wardrobeStyles)[number]
