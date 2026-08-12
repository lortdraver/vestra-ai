import {
  analysisFieldKeys,
  clothingAnalysisSchema,
  type ClothingAnalysis,
} from './analysis-schema'
import type { AnalyzeClothingInput } from './provider'
import {
  getWardrobeFormalityFromLevel,
  getWardrobeFormalityLevel,
  normalizeWardrobeColorFamilies,
  normalizeWardrobeFormality,
  normalizeWardrobeStyleTags,
  normalizeWardrobeSubtype,
  resolveWardrobeTaxonomy,
  type WardrobeStoredSubtype,
} from '@/lib/wardrobe/taxonomy'

const lowConfidenceThreshold = 0.6

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value))
}

function normalizeSubtypeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function detectSubtypeFromText(text: string): WardrobeStoredSubtype {
  const rawLowerText = text.toLowerCase()
  if (/\bt[\s_-]?shirt\b|\btee\b/.test(rawLowerText)) {
    return 't_shirt'
  }

  const normalizedText = normalizeSubtypeToken(text)

  const subtypeMatchers: Array<[RegExp, WardrobeStoredSubtype]> = [
    [/\bt_?shirt\b|\btee\b|\bфутболк/, 't_shirt'],
    [/\bpolo\b/, 'polo'],
    [/\bshirt\b|\boxford\b|\bрубашк/, 'shirt'],
    [/\bhoodie\b|\bхуди\b/, 'hoodie'],
    [/\bsweatshirt\b|\bсвитшот\b/, 'sweatshirt'],
    [/\bsweater\b|\bjumper\b|\bсвитер\b/, 'sweater'],
    [/\btank_?top\b|\btank\b|\bмайк/, 'tank_top'],
    [/\bblouse\b|\bблуз/, 'blouse'],
    [/\bjeans\b|\bджинс/, 'jeans'],
    [/\btrousers\b|\bpants\b|\bбрюк/, 'trousers'],
    [/\bchinos\b/, 'chinos'],
    [/\bshorts\b|\bшорт/, 'shorts'],
    [/\bjoggers\b|\bджоггер/, 'joggers'],
    [/\bsweatpants\b/, 'sweatpants'],
    [/\bskirt\b|\bюбк/, 'skirt'],
    [/\bleggings\b|\bлеггинс/, 'leggings'],
    [/\bjacket\b|\bкуртк/, 'jacket'],
    [/\bcoat\b|\bпальто\b/, 'coat'],
    [/\bblazer\b|\bблейзер/, 'blazer'],
    [/\bcardigan\b|\bкардиган/, 'cardigan'],
    [/\bovershirt\b/, 'overshirt'],
    [/\bvest\b|\bжилет/, 'vest'],
    [/\bdress\b|\bплать/, 'dress'],
    [/\bjumpsuit\b|\bкомбинезон/, 'jumpsuit'],
    [/\bsuit\b/, 'suit_set'],
    [/\bsneakers?\b|\btrainers?\b|\bкроссовк/, 'sneakers'],
    [/\bboots?\b|\bботин/, 'boots'],
    [/\bloafers?\b|\bлофер/, 'loafers'],
    [/\bsandals?\b|\bсандал/, 'sandals'],
    [/\bheels?\b|\bкаблук/, 'heels'],
    [/\bdress_?shoes\b|\boxfords?\b|\bтуфл/, 'dress_shoes'],
    [/\bcap\b|\bкепк/, 'cap'],
    [/\bhat\b|\bшляп/, 'hat'],
    [/\bbelt\b|\bремен/, 'belt'],
    [/\bbag\b|\bсумк/, 'bag'],
    [/\bwatch\b|\bчас/, 'watch'],
    [/\bscarf\b|\bшарф/, 'scarf'],
    [/\bjewel(?:ry|lery)\b|\bукраш/, 'jewelry'],
    [/\bglasses\b|\bочки\b/, 'glasses'],
  ]

  for (const [pattern, subtype] of subtypeMatchers) {
    if (pattern.test(normalizedText)) return subtype
  }

  const normalized = normalizeWardrobeSubtype(normalizedText, {
    allowUnresolved: true,
  })
  return normalized ?? 'unresolved'
}

function detectRoleSubtype(
  input: AnalyzeClothingInput,
  analysis: ClothingAnalysis,
) {
  const text = [
    input.name,
    input.category,
    input.clothingType,
    analysis.role,
    analysis.subtype,
    analysis.detectedCategory,
    analysis.detectedClothingType,
    analysis.visualDescription,
    analysis.brandGuess,
  ].join(' ')

  const detectedSubtype = detectSubtypeFromText(text)
  const resolved = resolveWardrobeTaxonomy({
    role: analysis.role,
    subtype: analysis.subtype,
    category: input.category,
    clothingType:
      detectedSubtype !== 'unresolved'
        ? detectedSubtype
        : input.clothingType || analysis.subtype,
    analysisRole: analysis.detectedCategory,
    analysisSubtype:
      detectedSubtype !== 'unresolved'
        ? detectedSubtype
        : analysis.detectedClothingType,
  })

  return {
    role: resolved.role,
    subtype:
      detectedSubtype !== 'unresolved' ? detectedSubtype : resolved.subtype,
  }
}

function detectBrand(input: AnalyzeClothingInput, analysis: ClothingAnalysis) {
  const text = `${input.name} ${input.clothingType} ${analysis.brandGuess} ${analysis.visualDescription}`

  if (/\blevi'?s\b/i.test(text)) return "Levi's"
  if (/\bnike\b/i.test(text)) return 'Nike'
  if (/\badidas\b/i.test(text)) return 'Adidas'
  if (/\bzara\b/i.test(text)) return 'Zara'
  if (/\bh&m\b/i.test(text)) return 'H&M'

  return analysis.brandGuess
}

function inferMaterial(
  input: AnalyzeClothingInput,
  analysis: ClothingAnalysis,
  subtype: string,
) {
  const text =
    `${input.name} ${input.clothingType} ${analysis.visualDescription}`.toLowerCase()
  if (analysis.material) return analysis.material
  if (
    ['t_shirt', 'polo', 'shirt', 'tank_top'].includes(subtype) &&
    /cotton|tee|shirt|polo|jersey/.test(text)
  ) {
    return 'cotton'
  }
  if (['hoodie', 'sweatshirt', 'joggers', 'sweatpants'].includes(subtype)) {
    return 'cotton blend'
  }
  if (subtype === 'blazer' || subtype === 'trousers') {
    return 'wool blend'
  }
  return ''
}

function deriveFormality(
  analysis: ClothingAnalysis,
  role: string,
  subtype: string,
) {
  const direct = normalizeWardrobeFormality(analysis.formality)
  if (direct) {
    return {
      formality: direct,
      formalityLevel: getWardrobeFormalityLevel(direct),
    }
  }

  if (
    ['dress_shoes', 'blazer', 'shirt', 'trousers', 'loafers'].includes(subtype)
  ) {
    return { formality: 'business', formalityLevel: 4 }
  }
  if (['dress', 'suit_set', 'heels'].includes(subtype)) {
    return { formality: 'formal', formalityLevel: 5 }
  }
  if (['joggers', 'sweatpants', 'hoodie', 'sneakers'].includes(subtype)) {
    return { formality: 'casual', formalityLevel: 2 }
  }
  if (role === 'accessory') {
    return {
      formality: getWardrobeFormalityFromLevel(analysis.formalityLevel),
      formalityLevel: Math.max(1, Math.min(5, analysis.formalityLevel)),
    }
  }
  return {
    formality: getWardrobeFormalityFromLevel(analysis.formalityLevel),
    formalityLevel: Math.max(1, Math.min(5, analysis.formalityLevel)),
  }
}

function buildFieldConfidences(
  analysis: ClothingAnalysis,
  deterministic: Partial<Record<(typeof analysisFieldKeys)[number], number>>,
) {
  const fieldConfidences = { ...analysis.fieldConfidences }

  for (const key of analysisFieldKeys) {
    fieldConfidences[key] = clampConfidence(
      deterministic[key] ?? fieldConfidences[key] ?? analysis.confidenceScore,
    )
  }

  return fieldConfidences
}

export function enhanceClothingAnalysis(
  analysis: ClothingAnalysis,
  input: AnalyzeClothingInput,
): ClothingAnalysis {
  const hintedColors = input.imageColorHints?.colors ?? []
  const hintedHexColors = input.imageColorHints?.dominantHexColors ?? []
  const roleSubtype = detectRoleSubtype(input, analysis)
  const brandGuess = detectBrand(input, analysis)
  const material = inferMaterial(input, analysis, roleSubtype.subtype)
  const colors = hintedColors.length
    ? hintedColors.map((value) => value.toLowerCase())
    : unique([...(input.colors ?? []), ...analysis.colors])
  const colorFamilies =
    normalizeWardrobeColorFamilies(analysis.colorFamilies).length > 0
      ? normalizeWardrobeColorFamilies(analysis.colorFamilies)
      : normalizeWardrobeColorFamilies(colors)
  const dominantHexColors = hintedHexColors.length
    ? hintedHexColors
    : analysis.dominantHexColors
  const styleTags = unique(
    normalizeWardrobeStyleTags(analysis.styleTags).length > 0
      ? normalizeWardrobeStyleTags(analysis.styleTags)
      : normalizeWardrobeStyleTags(analysis.style),
  )
  const formality = deriveFormality(
    analysis,
    roleSubtype.role,
    roleSubtype.subtype,
  )

  const deterministicConfidences: Partial<
    Record<(typeof analysisFieldKeys)[number], number>
  > = {}

  if (roleSubtype.role !== analysis.role) deterministicConfidences.role = 0.9
  if (roleSubtype.subtype !== analysis.subtype) {
    deterministicConfidences.subtype = 0.92
  }
  if (hintedColors.length) deterministicConfidences.colors = 0.88
  if (colorFamilies.length) deterministicConfidences.colorFamilies = 0.86
  if (hintedHexColors.length) deterministicConfidences.dominantHexColors = 0.88
  if (brandGuess && brandGuess !== analysis.brandGuess) {
    deterministicConfidences.brandGuess = 0.82
  }
  if (formality.formality !== analysis.formality) {
    deterministicConfidences.formality = 0.84
    deterministicConfidences.formalityLevel = 0.84
  }

  const fieldConfidences = buildFieldConfidences(
    analysis,
    deterministicConfidences,
  )
  const needsReviewFields = analysisFieldKeys.filter(
    (field) => (fieldConfidences[field] ?? 0) < lowConfidenceThreshold,
  )

  return clothingAnalysisSchema.parse({
    ...analysis,
    role: roleSubtype.role,
    subtype: roleSubtype.subtype,
    detectedCategory: roleSubtype.role,
    detectedClothingType: roleSubtype.subtype,
    colors,
    colorFamilies,
    dominantHexColors,
    material,
    style: styleTags,
    styleTags,
    formality: formality.formality,
    formalityLevel: formality.formalityLevel,
    brandGuess,
    fieldConfidences,
    needsReviewFields,
    promptVersion: 'clothing-analysis-v3',
  })
}
