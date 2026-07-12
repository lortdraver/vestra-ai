import {
  acceptedImageTypes,
  maxUploadedImageBytes,
  wardrobeCategories,
  wardrobeSeasons,
  wardrobeStyles,
} from './constants'
import type { WardrobeItemPayload } from './types'

type ValidationResult<T> =
  { ok: true; data: T } | { ok: false; message: string; status: number }

const textLimit = {
  name: 80,
  category: 40,
  clothingType: 80,
  material: 80,
  brand: 80,
  notes: 1_000,
  token: 40,
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function parseList(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12)
    .map((item) => item.slice(0, textLimit.token))
}

function keepKnownValues(values: string[], allowed: readonly string[]) {
  return values.filter((value) => allowed.includes(value))
}

function parseImageColorHints(value: FormDataEntryValue | null) {
  if (!value) return null

  try {
    const parsed = JSON.parse(String(value)) as {
      colors?: unknown
      dominantHexColors?: unknown
    }
    const colors = Array.isArray(parsed.colors)
      ? parsed.colors
          .map((item) => String(item).trim().toLowerCase().slice(0, 40))
          .filter(Boolean)
          .slice(0, 6)
      : []
    const dominantHexColors = Array.isArray(parsed.dominantHexColors)
      ? parsed.dominantHexColors
          .map((item) => String(item).trim().toLowerCase())
          .filter((item) => /^#[0-9a-f]{6}$/.test(item))
          .slice(0, 6)
      : []

    if (colors.length === 0 && dominantHexColors.length === 0) return null
    return { colors, dominantHexColors }
  } catch {
    return null
  }
}

export function parseWardrobePayload(
  formData: FormData,
): ValidationResult<WardrobeItemPayload> {
  const payload = {
    name: cleanText(formData.get('name'), textLimit.name),
    category: cleanText(formData.get('category'), textLimit.category),
    clothingType: cleanText(
      formData.get('clothingType'),
      textLimit.clothingType,
    ),
    colors: parseList(formData.get('colors')),
    seasons: keepKnownValues(
      parseList(formData.get('seasons')),
      wardrobeSeasons,
    ),
    styles: keepKnownValues(parseList(formData.get('styles')), wardrobeStyles),
    material: cleanText(formData.get('material'), textLimit.material),
    brand: cleanText(formData.get('brand'), textLimit.brand),
    notes: cleanText(formData.get('notes'), textLimit.notes),
    imageColorHints: parseImageColorHints(formData.get('imageColorHints')),
  }

  if (!payload.name || !payload.category || !payload.clothingType) {
    return { ok: false, message: 'missing_required_fields', status: 400 }
  }

  if (!wardrobeCategories.includes(payload.category as never)) {
    return { ok: false, message: 'invalid_category', status: 400 }
  }

  return { ok: true, data: payload }
}

export function validateImageFile(file: File | null): ValidationResult<File> {
  if (!file) {
    return { ok: false, message: 'missing_image', status: 400 }
  }

  if (!acceptedImageTypes.includes(file.type as never)) {
    return { ok: false, message: 'invalid_image_type', status: 400 }
  }

  if (file.size > maxUploadedImageBytes) {
    return { ok: false, message: 'image_too_large', status: 413 }
  }

  return { ok: true, data: file }
}
