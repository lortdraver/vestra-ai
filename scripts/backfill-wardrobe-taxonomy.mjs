import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const unresolvedRole = 'unresolved'
const unresolvedSubtype = 'unresolved'

const storedRoles = [
  'top',
  'bottom',
  'outerwear',
  'one_piece',
  'shoes',
  'accessory',
  unresolvedRole,
]

const storedSubtypes = [
  't_shirt',
  'shirt',
  'polo',
  'hoodie',
  'sweatshirt',
  'sweater',
  'tank_top',
  'blouse',
  'jeans',
  'trousers',
  'chinos',
  'shorts',
  'joggers',
  'sweatpants',
  'skirt',
  'leggings',
  'jacket',
  'coat',
  'blazer',
  'cardigan',
  'overshirt',
  'vest',
  'dress',
  'jumpsuit',
  'suit_set',
  'sneakers',
  'boots',
  'loafers',
  'sandals',
  'heels',
  'dress_shoes',
  'cap',
  'hat',
  'belt',
  'bag',
  'watch',
  'scarf',
  'jewelry',
  'glasses',
  unresolvedSubtype,
]

const seasons = ['spring', 'summer', 'autumn', 'winter']
const styleTags = [
  'casual',
  'formal',
  'business',
  'streetwear',
  'classic',
  'minimal',
  'sport',
  'evening',
  'smart_casual',
  'relaxed',
]
const formalityValues = [
  'relaxed',
  'casual',
  'smart_casual',
  'business',
  'formal',
]

const roleAliases = {
  top: 'top',
  tops: 'top',
  shirt: 'top',
  t_shirt: 'top',
  tshirt: 'top',
  tshirti: 'top',
  tee: 'top',
  ust_geyim: 'top',
  üst_geyim: 'top',
  ust: 'top',
  üst: 'top',
  верх: 'top',
  верхняя_одежда: 'outerwear',
  bottom: 'bottom',
  bottoms: 'bottom',
  нижняя_часть: 'bottom',
  низ: 'bottom',
  alt_geyim: 'bottom',
  alt: 'bottom',
  outerwear: 'outerwear',
  one_piece: 'one_piece',
  dress: 'one_piece',
  shoes: 'shoes',
  shoe: 'shoes',
  footwear: 'shoes',
  обувь: 'shoes',
  ayaqqabi: 'shoes',
  ayaqqabı: 'shoes',
  accessory: 'accessory',
  accessories: 'accessory',
  аксесуары: 'accessory',
  aksesuar: 'accessory',
  bag: 'accessory',
  other: unresolvedRole,
  diger: unresolvedRole,
  digər: unresolvedRole,
  другое: unresolvedRole,
  unresolved: unresolvedRole,
}

const subtypeAliases = {
  tshirt: 't_shirt',
  t_shirt: 't_shirt',
  't-shirt': 't_shirt',
  tee: 't_shirt',
  футболка: 't_shirt',
  koynek: 'shirt',
  köynək: 'shirt',
  shirt: 'shirt',
  рубашка: 'shirt',
  polo: 'polo',
  худи: 'hoodie',
  hoodie: 'hoodie',
  sweatshirt: 'sweatshirt',
  свитшот: 'sweatshirt',
  sweater: 'sweater',
  свитер: 'sweater',
  tank_top: 'tank_top',
  mayka: 'tank_top',
  майка: 'tank_top',
  blouse: 'blouse',
  блузка: 'blouse',
  jeans: 'jeans',
  джинсы: 'jeans',
  trousers: 'trousers',
  pants: 'trousers',
  брюки: 'trousers',
  chinos: 'chinos',
  shorts: 'shorts',
  short: 'shorts',
  шорты: 'shorts',
  joggers: 'joggers',
  sweatpants: 'sweatpants',
  skirt: 'skirt',
  юбка: 'skirt',
  leggings: 'leggings',
  jacket: 'jacket',
  куртка: 'jacket',
  coat: 'coat',
  пальто: 'coat',
  blazer: 'blazer',
  пиджак: 'blazer',
  cardigan: 'cardigan',
  кардиган: 'cardigan',
  overshirt: 'overshirt',
  vest: 'vest',
  жилет: 'vest',
  dress: 'dress',
  платье: 'dress',
  jumpsuit: 'jumpsuit',
  комбинезон: 'jumpsuit',
  suit_set: 'suit_set',
  suit: 'suit_set',
  костюм: 'suit_set',
  sneakers: 'sneakers',
  sneaker: 'sneakers',
  кроссовки: 'sneakers',
  boots: 'boots',
  ботинки: 'boots',
  loafers: 'loafers',
  лоферы: 'loafers',
  sandals: 'sandals',
  сандалии: 'sandals',
  heels: 'heels',
  каблуки: 'heels',
  dress_shoes: 'dress_shoes',
  oxford: 'dress_shoes',
  oxfords: 'dress_shoes',
  cap: 'cap',
  кепка: 'cap',
  hat: 'hat',
  шляпа: 'hat',
  belt: 'belt',
  ремень: 'belt',
  bag: 'bag',
  сумка: 'bag',
  watch: 'watch',
  часы: 'watch',
  scarf: 'scarf',
  шарф: 'scarf',
  jewelry: 'jewelry',
  jewellery: 'jewelry',
  украшения: 'jewelry',
  glasses: 'glasses',
  очки: 'glasses',
  other: unresolvedSubtype,
  diger: unresolvedSubtype,
  digər: unresolvedSubtype,
  другое: unresolvedSubtype,
  unresolved: unresolvedSubtype,
}

const subtypeToRole = {
  t_shirt: 'top',
  shirt: 'top',
  polo: 'top',
  hoodie: 'top',
  sweatshirt: 'top',
  sweater: 'top',
  tank_top: 'top',
  blouse: 'top',
  jeans: 'bottom',
  trousers: 'bottom',
  chinos: 'bottom',
  shorts: 'bottom',
  joggers: 'bottom',
  sweatpants: 'bottom',
  skirt: 'bottom',
  leggings: 'bottom',
  jacket: 'outerwear',
  coat: 'outerwear',
  blazer: 'outerwear',
  cardigan: 'outerwear',
  overshirt: 'outerwear',
  vest: 'outerwear',
  dress: 'one_piece',
  jumpsuit: 'one_piece',
  suit_set: 'one_piece',
  sneakers: 'shoes',
  boots: 'shoes',
  loafers: 'shoes',
  sandals: 'shoes',
  heels: 'shoes',
  dress_shoes: 'shoes',
  cap: 'accessory',
  hat: 'accessory',
  belt: 'accessory',
  bag: 'accessory',
  watch: 'accessory',
  scarf: 'accessory',
  jewelry: 'accessory',
  glasses: 'accessory',
}

const seasonAliases = {
  spring: 'spring',
  yaz: 'summer',
  yay: 'summer',
  summer: 'summer',
  лето: 'summer',
  autumn: 'autumn',
  fall: 'autumn',
  payiz: 'autumn',
  payız: 'autumn',
  осень: 'autumn',
  winter: 'winter',
  qis: 'winter',
  qış: 'winter',
  зима: 'winter',
}

const styleAliases = {
  casual: 'casual',
  gündəlik: 'casual',
  gundelik: 'casual',
  повседневный: 'casual',
  formal: 'formal',
  business: 'business',
  streetwear: 'streetwear',
  classic: 'classic',
  minimal: 'minimal',
  sport: 'sport',
  sporty: 'sport',
  evening: 'evening',
  smart_casual: 'smart_casual',
  smartcasual: 'smart_casual',
  relaxed: 'relaxed',
}

const formalityAliases = {
  relaxed: 'relaxed',
  casual: 'casual',
  smart_casual: 'smart_casual',
  smartcasual: 'smart_casual',
  business: 'business',
  formal: 'formal',
  low: 'casual',
  medium: 'smart_casual',
  high: 'formal',
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, '')

    if (!process.env[key]) process.env[key] = value
  }
}

function getArg(name) {
  const prefix = `--${name}=`
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
}

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
}

function unique(values) {
  return [...new Set(values)]
}

function normalizeRole(value) {
  const slug = slugify(value)
  return roleAliases[slug] ?? null
}

function normalizeSubtype(value) {
  const slug = slugify(value)
  return subtypeAliases[slug] ?? null
}

function normalizeSeason(value) {
  const slug = slugify(value)
  return seasonAliases[slug] ?? null
}

function normalizeStyle(value) {
  const slug = slugify(value)
  return styleAliases[slug] ?? null
}

function normalizeFormality(value) {
  const slug = slugify(value)
  return formalityAliases[slug] ?? null
}

function getFormalityLevel(formality) {
  switch (normalizeFormality(formality)) {
    case 'relaxed':
      return 1
    case 'casual':
      return 2
    case 'smart_casual':
      return 3
    case 'business':
      return 4
    case 'formal':
      return 5
    default:
      return 2
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value
  return []
}

function normalizeSeasons(values) {
  return unique(
    toArray(values)
      .map((value) => normalizeSeason(value))
      .filter((value) => seasons.includes(value)),
  )
}

function normalizeStyles(values) {
  return unique(
    toArray(values)
      .map((value) => normalizeStyle(value))
      .filter((value) => styleTags.includes(value)),
  )
}

function resolveTaxonomy(input) {
  const subtype =
    normalizeSubtype(input.subtype) ??
    normalizeSubtype(input.clothingType) ??
    normalizeSubtype(input.detectedClothingType)
  const derivedRole = subtype
    ? (subtypeToRole[subtype] ?? unresolvedRole)
    : null
  const role =
    derivedRole ??
    normalizeRole(input.role) ??
    normalizeRole(input.category) ??
    normalizeRole(input.detectedCategory) ??
    unresolvedRole

  return {
    role: storedRoles.includes(role) ? role : unresolvedRole,
    subtype:
      subtype && storedSubtypes.includes(subtype) ? subtype : unresolvedSubtype,
  }
}

function normalizeAnalysisRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record
  }

  const current = { ...record }
  const taxonomy = resolveTaxonomy(current)
  const formality =
    normalizeFormality(current.formality) ??
    (Number.isFinite(Number(current.formalityLevel))
      ? formalityValues[
          Math.max(0, Math.min(4, Number(current.formalityLevel) - 1))
        ]
      : null)

  return {
    ...current,
    role: taxonomy.role,
    subtype: taxonomy.subtype,
    detectedCategory: taxonomy.role,
    detectedClothingType: taxonomy.subtype,
    season: normalizeSeasons(current.season),
    style: normalizeStyles(current.style ?? current.styleTags),
    styleTags: normalizeStyles(current.styleTags ?? current.style),
    formality: formality ?? current.formality ?? 'casual',
    formalityLevel: Number.isFinite(Number(current.formalityLevel))
      ? Math.max(1, Math.min(5, Number(current.formalityLevel)))
      : getFormalityLevel(formality),
  }
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortJson(value[key])]),
    )
  }
  return value
}

function stableJson(value) {
  return JSON.stringify(sortJson(value))
}

loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

const dryRun = !process.argv.includes('--apply')
const limit = Math.max(1, Math.min(Number(getArg('limit') ?? 200), 5000))
const userId = getArg('user-id')

if (!process.env.DATABASE_URL) {
  console.log(
    JSON.stringify(
      { ok: false, dryRun, error: 'database_url_missing' },
      null,
      2,
    ),
  )
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const params = userId ? [userId, limit] : [limit]
const where = userId ? 'where "userId" = $1' : ''
const limitParam = userId ? '$2' : '$1'
const result = await client.query(
  `
    select id, "userId", category, "clothingType", seasons, styles,
      "aiAnalysis", "userCorrections"
    from wardrobe_item
    ${where}
    order by "createdAt" asc
    limit ${limitParam}
  `,
  params,
)

const summary = {
  ok: true,
  dryRun,
  scanned: result.rowCount,
  changed: 0,
  updated: 0,
  failed: 0,
  unresolvedRoles: 0,
  unresolvedSubtypes: 0,
}

for (const row of result.rows) {
  try {
    const taxonomy = resolveTaxonomy({
      category: row.category,
      clothingType: row.clothingType,
      ...(row.aiAnalysis ?? {}),
    })
    const nextSeasons = normalizeSeasons(row.seasons)
    const nextStyles = normalizeStyles(row.styles)
    const nextAiAnalysis = row.aiAnalysis
      ? normalizeAnalysisRecord(row.aiAnalysis)
      : null
    const nextUserCorrections = row.userCorrections
      ? normalizeAnalysisRecord(row.userCorrections)
      : null

    if (taxonomy.role === unresolvedRole) summary.unresolvedRoles += 1
    if (taxonomy.subtype === unresolvedSubtype) summary.unresolvedSubtypes += 1

    const changed =
      row.category !== taxonomy.role ||
      row.clothingType !== taxonomy.subtype ||
      stableJson(row.seasons ?? []) !== stableJson(nextSeasons) ||
      stableJson(row.styles ?? []) !== stableJson(nextStyles) ||
      stableJson(row.aiAnalysis ?? null) !== stableJson(nextAiAnalysis) ||
      stableJson(row.userCorrections ?? null) !==
        stableJson(nextUserCorrections)

    if (!changed) continue

    summary.changed += 1
    if (dryRun) continue

    await client.query(
      `
        update wardrobe_item
        set category = $1,
            "clothingType" = $2,
            seasons = $3::jsonb,
            styles = $4::jsonb,
            "aiAnalysis" = $5::jsonb,
            "userCorrections" = $6::jsonb,
            "updatedAt" = now()
        where id = $7
      `,
      [
        taxonomy.role,
        taxonomy.subtype,
        JSON.stringify(nextSeasons),
        JSON.stringify(nextStyles),
        nextAiAnalysis ? JSON.stringify(nextAiAnalysis) : null,
        nextUserCorrections ? JSON.stringify(nextUserCorrections) : null,
        row.id,
      ],
    )

    summary.updated += 1
  } catch {
    summary.ok = false
    summary.failed += 1
  }
}

await client.end()
console.log(JSON.stringify(summary, null, 2))
if (!summary.ok) process.exitCode = 1
