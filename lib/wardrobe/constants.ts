export {
  wardrobeStoredRoles as wardrobeCategories,
  wardrobeSeasons,
  wardrobeStyleTags as wardrobeStyles,
  type WardrobeSeason,
  type WardrobeStoredRole as WardrobeCategory,
  type WardrobeStyleTag as WardrobeStyle,
} from './taxonomy'

export const acceptedImageTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const maxUploadedImageBytes = 2_500_000
