import { z } from 'zod'
import {
  getWardrobeFormalityFromLevel,
  getWardrobeFormalityLevel,
  normalizeWardrobeColorFamilies,
  normalizeWardrobeFormality,
  normalizeWardrobeRole,
  normalizeWardrobeSeason,
  normalizeWardrobeStyleTag,
  normalizeWardrobeSubtype,
  wardrobeColorFamilies,
  wardrobeFormalityValues,
  wardrobeSeasons,
  wardrobeStoredRoles,
  wardrobeStoredSubtypes,
  wardrobeStyleTags,
  type WardrobeColorFamily,
  type WardrobeSeason,
  type WardrobeStyleTag,
} from '@/lib/wardrobe/taxonomy'

export const analysisStatuses = [
  'pending',
  'analyzing',
  'done',
  'failed',
] as const

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase())

export const analysisFieldKeys = [
  'role',
  'subtype',
  'colors',
  'colorFamilies',
  'dominantHexColors',
  'material',
  'season',
  'styleTags',
  'fit',
  'pattern',
  'warmthLevel',
  'formality',
  'formalityLevel',
  'brandGuess',
  'visualDescription',
] as const

type AnalysisFieldKey = (typeof analysisFieldKeys)[number]

const analysisFieldAliases: Record<string, AnalysisFieldKey> = {
  role: 'role',
  detectedCategory: 'role',
  subtype: 'subtype',
  detectedClothingType: 'subtype',
  colors: 'colors',
  colorFamilies: 'colorFamilies',
  dominantHexColors: 'dominantHexColors',
  material: 'material',
  season: 'season',
  style: 'styleTags',
  styleTags: 'styleTags',
  fit: 'fit',
  pattern: 'pattern',
  warmthLevel: 'warmthLevel',
  formality: 'formality',
  formalityLevel: 'formalityLevel',
  brandGuess: 'brandGuess',
  visualDescription: 'visualDescription',
}

const fieldConfidenceSchema = z.partialRecord(
  z.enum(analysisFieldKeys),
  z.number().min(0).max(1),
)

const clothingAnalysisShape = {
  role: z.enum(wardrobeStoredRoles),
  subtype: z.enum(wardrobeStoredSubtypes),
  detectedCategory: z.enum(wardrobeStoredRoles),
  detectedClothingType: z.enum(wardrobeStoredSubtypes),
  colors: z.array(z.string().trim().min(1).max(40)).max(12),
  colorFamilies: z.array(z.enum(wardrobeColorFamilies)).max(8),
  dominantHexColors: z.array(hexColorSchema).max(8),
  material: z.string().trim().max(80).default(''),
  season: z.array(z.enum(wardrobeSeasons)).max(4),
  style: z.array(z.enum(wardrobeStyleTags)).max(12),
  styleTags: z.array(z.enum(wardrobeStyleTags)).max(12),
  fit: z.string().trim().max(80).default(''),
  pattern: z.string().trim().max(80).default(''),
  warmthLevel: z.number().int().min(1).max(5),
  formality: z.enum(wardrobeFormalityValues),
  formalityLevel: z.number().int().min(1).max(5),
  brandGuess: z.string().trim().max(80).default(''),
  confidenceScore: z.number().min(0).max(1),
  fieldConfidences: fieldConfidenceSchema.default({}),
  needsReviewFields: z.array(z.enum(analysisFieldKeys)).max(20).default([]),
  visualDescription: z.string().trim().min(1).max(1_000),
  promptVersion: z.string().trim().min(1).max(40),
  modelId: z.string().trim().min(1).max(120),
} as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown, max = 80) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function numberOrDefault(value: unknown, fallback: number) {
  const numeric = typeof value === 'string' ? Number(value) : value
  return typeof numeric === 'number' && Number.isFinite(numeric)
    ? numeric
    : fallback
}

function normalizeTextList(value: unknown, max = 12) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => text(item, 40).toLowerCase())
    .filter(Boolean)
    .slice(0, max)
}

function normalizeColorFamilies(
  explicitValue: unknown,
  colorValues: string[],
): WardrobeColorFamily[] {
  const explicit = normalizeWardrobeColorFamilies(
    Array.isArray(explicitValue)
      ? explicitValue.map((item) => String(item))
      : [],
  )
  if (explicit.length > 0) return explicit
  return normalizeWardrobeColorFamilies(colorValues)
}

function normalizeStyleTags(
  styleTagsValue: unknown,
  styleValue: unknown,
): WardrobeStyleTag[] {
  const source = Array.isArray(styleTagsValue)
    ? styleTagsValue
    : Array.isArray(styleValue)
      ? styleValue
      : []

  return source
    .map((item) => normalizeWardrobeStyleTag(String(item)))
    .filter((item): item is WardrobeStyleTag => Boolean(item))
    .slice(0, 12)
}

function normalizeSeasons(value: unknown): WardrobeSeason[] {
  return (Array.isArray(value) ? value : [])
    .map((item) => normalizeWardrobeSeason(String(item)))
    .filter((item): item is WardrobeSeason => Boolean(item))
    .slice(0, 4)
}

function normalizeFieldConfidences(
  value: unknown,
): Partial<Record<AnalysisFieldKey, number>> {
  const record = asRecord(value)
  if (!record) return {}

  return Object.entries(record).reduce<
    Partial<Record<AnalysisFieldKey, number>>
  >((accumulator, [key, fieldValue]) => {
    const normalizedKey = analysisFieldAliases[key]
    if (!normalizedKey) return accumulator
    const confidence = numberOrDefault(fieldValue, NaN)
    if (!Number.isFinite(confidence)) return accumulator
    accumulator[normalizedKey] = Math.max(0, Math.min(1, confidence))
    return accumulator
  }, {})
}

function normalizeNeedsReviewFields(value: unknown): AnalysisFieldKey[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((item) => analysisFieldAliases[String(item)])
    .filter((item): item is AnalysisFieldKey => Boolean(item))

  return Array.from(new Set(normalized)).slice(0, 20)
}

function normalizeAnalysisRecord(value: unknown) {
  const record = asRecord(value)
  if (!record) return value

  const rawRole =
    normalizeWardrobeRole(text(record.role), { allowUnresolved: true }) ??
    normalizeWardrobeRole(text(record.detectedCategory), {
      allowUnresolved: true,
    }) ??
    normalizeWardrobeRole(text(record.category), { allowUnresolved: true })
  const rawSubtype =
    normalizeWardrobeSubtype(text(record.subtype), {
      allowUnresolved: true,
      role: rawRole,
    }) ??
    normalizeWardrobeSubtype(text(record.detectedClothingType), {
      allowUnresolved: true,
      role: rawRole,
    }) ??
    normalizeWardrobeSubtype(text(record.clothingType), {
      allowUnresolved: true,
      role: rawRole,
    })

  const subtype = rawSubtype ?? 'unresolved'
  const role =
    rawRole ??
    normalizeWardrobeRole(subtype, { allowUnresolved: true }) ??
    'unresolved'

  const colors = normalizeTextList(record.colors)
  const dominantHexColors = Array.isArray(record.dominantHexColors)
    ? record.dominantHexColors
        .map((item) => String(item).trim().toLowerCase())
        .filter((item) => /^#[0-9a-f]{6}$/.test(item))
        .slice(0, 8)
    : []
  const styleTags = normalizeStyleTags(record.styleTags, record.style)
  const season = normalizeSeasons(record.season)
  const formality =
    normalizeWardrobeFormality(text(record.formality)) ??
    getWardrobeFormalityFromLevel(numberOrDefault(record.formalityLevel, 2))
  const formalityLevel =
    Math.max(
      1,
      Math.min(
        5,
        Math.round(
          numberOrDefault(
            record.formalityLevel,
            getWardrobeFormalityLevel(formality),
          ),
        ),
      ),
    ) || getWardrobeFormalityLevel(formality)

  return {
    role,
    subtype,
    detectedCategory: role,
    detectedClothingType: subtype,
    colors,
    colorFamilies: normalizeColorFamilies(record.colorFamilies, colors),
    dominantHexColors,
    material: text(record.material),
    season,
    style: styleTags,
    styleTags,
    fit: text(record.fit),
    pattern: text(record.pattern),
    warmthLevel: Math.max(
      1,
      Math.min(5, Math.round(numberOrDefault(record.warmthLevel, 2))),
    ),
    formality,
    formalityLevel,
    brandGuess: text(record.brandGuess),
    confidenceScore: numberOrDefault(record.confidenceScore, 0.7),
    fieldConfidences: normalizeFieldConfidences(record.fieldConfidences),
    needsReviewFields: normalizeNeedsReviewFields(record.needsReviewFields),
    visualDescription: text(record.visualDescription, 1_000),
    promptVersion: text(record.promptVersion, 40) || 'clothing-analysis-v3',
    modelId: text(record.modelId, 120) || 'unknown',
  }
}

export const clothingAnalysisSchema = z.preprocess(
  normalizeAnalysisRecord,
  z.object(clothingAnalysisShape),
)

const clothingAnalysisCorrectionsShape = {
  role: z.enum(wardrobeStoredRoles).optional(),
  subtype: z.enum(wardrobeStoredSubtypes).optional(),
  detectedCategory: z.enum(wardrobeStoredRoles).optional(),
  detectedClothingType: z.enum(wardrobeStoredSubtypes).optional(),
  colors: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  colorFamilies: z.array(z.enum(wardrobeColorFamilies)).max(8).optional(),
  dominantHexColors: z.array(hexColorSchema).max(8).optional(),
  material: z.string().trim().max(80).optional(),
  season: z.array(z.enum(wardrobeSeasons)).max(4).optional(),
  style: z.array(z.enum(wardrobeStyleTags)).max(12).optional(),
  styleTags: z.array(z.enum(wardrobeStyleTags)).max(12).optional(),
  fit: z.string().trim().max(80).optional(),
  pattern: z.string().trim().max(80).optional(),
  warmthLevel: z.number().int().min(1).max(5).optional(),
  formality: z.enum(wardrobeFormalityValues).optional(),
  formalityLevel: z.number().int().min(1).max(5).optional(),
  brandGuess: z.string().trim().max(80).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  visualDescription: z.string().trim().max(1_000).optional(),
} as const

function normalizeCorrectionsRecord(value: unknown) {
  const record = asRecord(value)
  if (!record) return value

  const normalized = normalizeAnalysisRecord(record) as Record<string, unknown>
  const output: Record<string, unknown> = {}

  for (const key of Object.keys(record)) {
    const mappedKey =
      key === 'detectedCategory'
        ? 'role'
        : key === 'detectedClothingType'
          ? 'subtype'
          : key === 'style'
            ? 'styleTags'
            : key
    if (mappedKey in normalized) {
      output[mappedKey] = normalized[mappedKey as keyof typeof normalized]
    }
  }

  if ('role' in output && !('detectedCategory' in output)) {
    output.detectedCategory = output.role
  }
  if ('subtype' in output && !('detectedClothingType' in output)) {
    output.detectedClothingType = output.subtype
  }
  if ('styleTags' in output && !('style' in output)) {
    output.style = output.styleTags
  }

  return output
}

export const clothingAnalysisCorrectionsSchema = z.preprocess(
  normalizeCorrectionsRecord,
  z.object(clothingAnalysisCorrectionsShape),
)

export type AnalysisStatus = (typeof analysisStatuses)[number]
export type ClothingAnalysis = z.infer<typeof clothingAnalysisSchema>
export type ClothingAnalysisCorrections = z.infer<
  typeof clothingAnalysisCorrectionsSchema
>

export function parseClothingAnalysis(value: unknown): ClothingAnalysis {
  return clothingAnalysisSchema.parse(value)
}

export function parseAnalysisCorrections(
  value: unknown,
): ClothingAnalysisCorrections {
  return clothingAnalysisCorrectionsSchema.parse(value)
}

export function mergeAnalysisCorrections(
  analysis: ClothingAnalysis | null,
  corrections: ClothingAnalysisCorrections | null,
) {
  if (!analysis) return null
  if (!corrections) return analysis

  const merged = {
    ...analysis,
    ...corrections,
    role: corrections.role ?? corrections.detectedCategory ?? analysis.role,
    subtype:
      corrections.subtype ??
      corrections.detectedClothingType ??
      analysis.subtype,
    styleTags: corrections.styleTags ?? corrections.style ?? analysis.styleTags,
    style: corrections.style ?? corrections.styleTags ?? analysis.style,
    formality:
      corrections.formality ??
      (typeof corrections.formalityLevel === 'number'
        ? getWardrobeFormalityFromLevel(corrections.formalityLevel)
        : analysis.formality),
    formalityLevel:
      corrections.formalityLevel ??
      (corrections.formality
        ? getWardrobeFormalityLevel(corrections.formality)
        : analysis.formalityLevel),
    detectedCategory:
      corrections.role ?? corrections.detectedCategory ?? analysis.role,
    detectedClothingType:
      corrections.subtype ??
      corrections.detectedClothingType ??
      analysis.subtype,
  }

  return clothingAnalysisSchema.parse(merged)
}
