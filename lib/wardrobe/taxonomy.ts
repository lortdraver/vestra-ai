import type { Locale } from '@/lib/i18n/config'

export const canonicalWardrobeRoles = [
  'top',
  'bottom',
  'outerwear',
  'one_piece',
  'shoes',
  'accessory',
] as const

export const unresolvedWardrobeRole = 'unresolved' as const

export const wardrobeRoles = canonicalWardrobeRoles
export const wardrobeStoredRoles = [
  ...canonicalWardrobeRoles,
  unresolvedWardrobeRole,
] as const

export const wardrobeSubtypesByRole = {
  top: [
    't_shirt',
    'shirt',
    'polo',
    'hoodie',
    'sweatshirt',
    'sweater',
    'tank_top',
    'blouse',
  ],
  bottom: [
    'jeans',
    'trousers',
    'chinos',
    'shorts',
    'joggers',
    'sweatpants',
    'skirt',
    'leggings',
  ],
  outerwear: ['jacket', 'coat', 'blazer', 'cardigan', 'overshirt', 'vest'],
  one_piece: ['dress', 'jumpsuit', 'suit_set'],
  shoes: ['sneakers', 'boots', 'loafers', 'sandals', 'heels', 'dress_shoes'],
  accessory: [
    'cap',
    'hat',
    'belt',
    'bag',
    'watch',
    'scarf',
    'jewelry',
    'glasses',
  ],
} as const

export const unresolvedWardrobeSubtype = 'unresolved' as const

export const wardrobeSubtypes = Object.values(
  wardrobeSubtypesByRole,
).flat() as [
  (typeof wardrobeSubtypesByRole)[keyof typeof wardrobeSubtypesByRole][number],
  ...(typeof wardrobeSubtypesByRole)[keyof typeof wardrobeSubtypesByRole][number][],
]

export const wardrobeStoredSubtypes = [
  ...wardrobeSubtypes,
  unresolvedWardrobeSubtype,
] as const

export const wardrobeSeasons = ['spring', 'summer', 'autumn', 'winter'] as const

export const wardrobeStyleTags = [
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
] as const

export const wardrobeFormalityValues = [
  'relaxed',
  'casual',
  'smart_casual',
  'business',
  'formal',
] as const

export const wardrobeColorFamilies = [
  'black',
  'white',
  'gray',
  'navy',
  'blue',
  'beige',
  'brown',
  'green',
  'red',
  'burgundy',
  'pink',
  'yellow',
  'orange',
  'purple',
] as const

export type WardrobeRole = (typeof canonicalWardrobeRoles)[number]
export type WardrobeStoredRole = (typeof wardrobeStoredRoles)[number]
export type WardrobeSubtype = (typeof wardrobeSubtypes)[number]
export type WardrobeStoredSubtype = (typeof wardrobeStoredSubtypes)[number]
export type WardrobeSeason = (typeof wardrobeSeasons)[number]
export type WardrobeStyleTag = (typeof wardrobeStyleTags)[number]
export type WardrobeFormality = (typeof wardrobeFormalityValues)[number]
export type WardrobeColorFamily = (typeof wardrobeColorFamilies)[number]

const roleBySubtype = Object.entries(wardrobeSubtypesByRole).reduce<
  Record<string, WardrobeRole>
>((accumulator, [role, subtypes]) => {
  for (const subtype of subtypes) {
    accumulator[subtype] = role as WardrobeRole
  }
  return accumulator
}, {})

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9а-яёəğıöşüç\s_-]+/giu, ' ')
    .replace(/[_\s-]+/g, '_')
}

const roleAliases: Record<string, WardrobeStoredRole> = {
  top: 'top',
  tops: 'top',
  upper: 'top',
  верх: 'top',
  ust: 'top',
  ust_geyim: 'top',
  koynek: 'top',
  koeynek: 'top',
  köynək: 'top',
  shirt: 'top',
  tshirt: 'top',
  t_shirt: 'top',
  tee: 'top',
  polo: 'top',
  blouse: 'top',
  hoodie: 'top',
  sweater: 'top',
  sweatshirt: 'top',
  tank_top: 'top',
  футболка: 'top',
  рубашка: 'top',

  bottom: 'bottom',
  bottoms: 'bottom',
  ниж: 'bottom',
  alt: 'bottom',
  alt_geyim: 'bottom',
  salvar: 'bottom',
  şalvar: 'bottom',
  jeans: 'bottom',
  trousers: 'bottom',
  pants: 'bottom',
  chinos: 'bottom',
  shorts: 'bottom',
  joggers: 'bottom',
  sweatpants: 'bottom',
  skirt: 'bottom',
  leggings: 'bottom',
  брюки: 'bottom',
  джинсы: 'bottom',
  шорты: 'bottom',

  outerwear: 'outerwear',
  jacket: 'outerwear',
  coat: 'outerwear',
  blazer: 'outerwear',
  cardigan: 'outerwear',
  overshirt: 'outerwear',
  vest: 'outerwear',
  верхняя_одежда: 'outerwear',
  kurtka: 'outerwear',
  jaket: 'outerwear',

  one_piece: 'one_piece',
  onepiece: 'one_piece',
  dress: 'one_piece',
  dresses: 'one_piece',
  jumpsuit: 'one_piece',
  suit: 'one_piece',
  suit_set: 'one_piece',
  платье: 'one_piece',
  комбинезон: 'one_piece',

  shoe: 'shoes',
  shoes: 'shoes',
  footwear: 'shoes',
  sneakers: 'shoes',
  sneaker: 'shoes',
  trainers: 'shoes',
  boots: 'shoes',
  loafers: 'shoes',
  sandals: 'shoes',
  heels: 'shoes',
  ayaqqabi: 'shoes',
  ayaqqabı: 'shoes',
  обувь: 'shoes',

  accessory: 'accessory',
  accessories: 'accessory',
  bag: 'accessory',
  belt: 'accessory',
  cap: 'accessory',
  hat: 'accessory',
  watch: 'accessory',
  scarf: 'accessory',
  jewelry: 'accessory',
  jewellery: 'accessory',
  glasses: 'accessory',
  сумка: 'accessory',
  аксессуар: 'accessory',
  aksesuar: 'accessory',
  çanta: 'accessory',
  canta: 'accessory',

  bags: 'accessory',
  underwear: 'unresolved',
  activewear: 'unresolved',
  other: 'unresolved',
  diger: 'unresolved',
  digər: 'unresolved',
  другое: 'unresolved',
  unresolved: 'unresolved',
  unknown: 'unresolved',
}

const subtypeAliases: Record<string, WardrobeStoredSubtype> = {
  tshirt: 't_shirt',
  t_shirt: 't_shirt',
  tee: 't_shirt',
  футболка: 't_shirt',
  майка: 'tank_top',
  tank: 'tank_top',
  tank_top: 'tank_top',
  shirt: 'shirt',
  oxford: 'shirt',
  button_up: 'shirt',
  polo: 'polo',
  hoodie: 'hoodie',
  sweatshirt: 'sweatshirt',
  sweater: 'sweater',
  blouse: 'blouse',

  jeans: 'jeans',
  trousers: 'trousers',
  pants: 'trousers',
  slacks: 'trousers',
  chinos: 'chinos',
  shorts: 'shorts',
  joggers: 'joggers',
  sweatpants: 'sweatpants',
  skirt: 'skirt',
  leggings: 'leggings',
  şalvar: 'trousers',
  salvar: 'trousers',
  брюки: 'trousers',
  джинсы: 'jeans',

  jacket: 'jacket',
  coat: 'coat',
  blazer: 'blazer',
  cardigan: 'cardigan',
  overshirt: 'overshirt',
  vest: 'vest',

  dress: 'dress',
  jumpsuit: 'jumpsuit',
  suit: 'suit_set',
  suit_set: 'suit_set',
  платье: 'dress',
  комбинезон: 'jumpsuit',

  sneakers: 'sneakers',
  sneaker: 'sneakers',
  trainers: 'sneakers',
  boots: 'boots',
  loafers: 'loafers',
  sandals: 'sandals',
  heels: 'heels',
  dress_shoes: 'dress_shoes',
  oxfords: 'dress_shoes',
  derby: 'dress_shoes',
  обувь: unresolvedWardrobeSubtype,
  ayaqqabi: unresolvedWardrobeSubtype,
  ayaqqabı: unresolvedWardrobeSubtype,

  cap: 'cap',
  hat: 'hat',
  belt: 'belt',
  bag: 'bag',
  watch: 'watch',
  scarf: 'scarf',
  jewelry: 'jewelry',
  jewellery: 'jewelry',
  glasses: 'glasses',
  сумка: 'bag',
  aksesuar: unresolvedWardrobeSubtype,
  аксессуар: unresolvedWardrobeSubtype,

  pending: unresolvedWardrobeSubtype,
  other: unresolvedWardrobeSubtype,
  diger: unresolvedWardrobeSubtype,
  digər: unresolvedWardrobeSubtype,
  другое: unresolvedWardrobeSubtype,
  unresolved: unresolvedWardrobeSubtype,
  unknown: unresolvedWardrobeSubtype,
}

const colorFamilyAliases: Record<string, WardrobeColorFamily> = {
  black: 'black',
  noir: 'black',
  white: 'white',
  cream: 'beige',
  ivory: 'beige',
  gray: 'gray',
  grey: 'gray',
  silver: 'gray',
  navy: 'navy',
  blue: 'blue',
  sky: 'blue',
  denim: 'blue',
  beige: 'beige',
  tan: 'beige',
  camel: 'beige',
  brown: 'brown',
  mocha: 'brown',
  chocolate: 'brown',
  green: 'green',
  olive: 'green',
  khaki: 'green',
  red: 'red',
  burgundy: 'burgundy',
  maroon: 'burgundy',
  wine: 'burgundy',
  pink: 'pink',
  yellow: 'yellow',
  mustard: 'yellow',
  orange: 'orange',
  purple: 'purple',
  violet: 'purple',
  lilac: 'purple',
}

const styleAliases: Record<string, WardrobeStyleTag> = {
  casual: 'casual',
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

const formalityAliases: Record<string, WardrobeFormality> = {
  relaxed: 'relaxed',
  casual: 'casual',
  smart_casual: 'smart_casual',
  smartcasual: 'smart_casual',
  business: 'business',
  formal: 'formal',
}

const seasonAliases: Record<string, WardrobeSeason> = {
  spring: 'spring',
  summer: 'summer',
  autumn: 'autumn',
  fall: 'autumn',
  winter: 'winter',
}

export function getWardrobeRoleForSubtype(
  subtype: string | null | undefined,
): WardrobeRole | null {
  const token = normalizeToken(String(subtype ?? ''))
  const normalizedSubtype = subtypeAliases[token]
  if (!normalizedSubtype || normalizedSubtype === unresolvedWardrobeSubtype) {
    return null
  }
  return roleBySubtype[normalizedSubtype] ?? null
}

export function normalizeWardrobeRole(
  value: string | null | undefined,
  options?: { allowUnresolved?: boolean },
): WardrobeStoredRole | null {
  const token = normalizeToken(String(value ?? ''))
  if (!token) return null
  const normalized = roleAliases[token]
  if (!normalized) return null
  if (
    normalized === unresolvedWardrobeRole &&
    options?.allowUnresolved === false
  ) {
    return null
  }
  return normalized
}

export function normalizeWardrobeSubtype(
  value: string | null | undefined,
  options?: { allowUnresolved?: boolean; role?: string | null | undefined },
): WardrobeStoredSubtype | null {
  const token = normalizeToken(String(value ?? ''))
  if (!token) return null
  const normalized = subtypeAliases[token]
  if (normalized) {
    if (
      normalized === unresolvedWardrobeSubtype &&
      options?.allowUnresolved === false
    ) {
      return null
    }
    if (!options?.role) return normalized

    const subtypeRole = getWardrobeRoleForSubtype(normalized)
    const requestedRole = normalizeWardrobeRole(options.role, {
      allowUnresolved: false,
    })
    if (!subtypeRole || !requestedRole || subtypeRole === requestedRole) {
      return normalized
    }
  }

  const inferred = getWardrobeRoleForSubtype(String(value ?? ''))
  if (!inferred) {
    return options?.allowUnresolved === false ? null : unresolvedWardrobeSubtype
  }

  const requestedRole = normalizeWardrobeRole(options?.role, {
    allowUnresolved: false,
  })
  return !requestedRole || requestedRole === inferred
    ? ((subtypeAliases[token] ??
        unresolvedWardrobeSubtype) as WardrobeStoredSubtype)
    : options?.allowUnresolved === false
      ? null
      : unresolvedWardrobeSubtype
}

export function normalizeWardrobeSeason(
  value: string | null | undefined,
): WardrobeSeason | null {
  return seasonAliases[normalizeToken(String(value ?? ''))] ?? null
}

export function normalizeWardrobeStyleTag(
  value: string | null | undefined,
): WardrobeStyleTag | null {
  return styleAliases[normalizeToken(String(value ?? ''))] ?? null
}

export function normalizeWardrobeFormality(
  value: string | null | undefined,
): WardrobeFormality | null {
  return formalityAliases[normalizeToken(String(value ?? ''))] ?? null
}

export function normalizeWardrobeColorFamily(
  value: string | null | undefined,
): WardrobeColorFamily | null {
  return colorFamilyAliases[normalizeToken(String(value ?? ''))] ?? null
}

export function getWardrobeFormalityFromLevel(
  level: number | null | undefined,
) {
  if (!Number.isFinite(level)) return 'casual' satisfies WardrobeFormality
  if ((level ?? 0) <= 1) return 'relaxed' satisfies WardrobeFormality
  if ((level ?? 0) <= 2) return 'casual' satisfies WardrobeFormality
  if ((level ?? 0) <= 3) return 'smart_casual' satisfies WardrobeFormality
  if ((level ?? 0) <= 4) return 'business' satisfies WardrobeFormality
  return 'formal' satisfies WardrobeFormality
}

export function getWardrobeFormalityLevel(
  formality: WardrobeFormality | string | null | undefined,
) {
  switch (normalizeWardrobeFormality(formality)) {
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

export function uniqueStrings<T extends string>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function normalizeWardrobeStyleTags(
  values: string[] | null | undefined,
) {
  return uniqueStrings(
    (values ?? [])
      .map((value) => normalizeWardrobeStyleTag(value))
      .filter((value): value is WardrobeStyleTag => Boolean(value)),
  )
}

export function normalizeWardrobeSeasons(values: string[] | null | undefined) {
  return uniqueStrings(
    (values ?? [])
      .map((value) => normalizeWardrobeSeason(value))
      .filter((value): value is WardrobeSeason => Boolean(value)),
  )
}

export function normalizeWardrobeColorFamilies(
  values: string[] | null | undefined,
) {
  return uniqueStrings(
    (values ?? [])
      .map((value) => normalizeWardrobeColorFamily(value))
      .filter((value): value is WardrobeColorFamily => Boolean(value)),
  )
}

export function resolveWardrobeTaxonomy(input: {
  role?: string | null
  subtype?: string | null
  category?: string | null
  clothingType?: string | null
  analysisRole?: string | null
  analysisSubtype?: string | null
}) {
  const candidates = [
    {
      role: normalizeWardrobeRole(input.role, { allowUnresolved: false }),
      subtype: normalizeWardrobeSubtype(input.subtype, {
        allowUnresolved: false,
        role: input.role,
      }),
      source: 'stored',
    },
    {
      role: normalizeWardrobeRole(input.category, { allowUnresolved: false }),
      subtype: normalizeWardrobeSubtype(input.clothingType, {
        allowUnresolved: false,
        role: input.category,
      }),
      source: 'legacy_stored',
    },
    {
      role: normalizeWardrobeRole(input.analysisRole, {
        allowUnresolved: false,
      }),
      subtype: normalizeWardrobeSubtype(input.analysisSubtype, {
        allowUnresolved: false,
        role: input.analysisRole,
      }),
      source: 'analysis',
    },
  ] as const

  for (const candidate of candidates) {
    const inferredRole = candidate.subtype
      ? getWardrobeRoleForSubtype(candidate.subtype)
      : null
    const role =
      candidate.role ?? inferredRole ?? normalizeWardrobeRole(candidate.subtype)
    if (!role) continue

    const subtype =
      candidate.subtype ??
      (role === candidate.role
        ? unresolvedWardrobeSubtype
        : unresolvedWardrobeSubtype)

    return {
      role,
      subtype,
      source: candidate.source,
      resolved: subtype !== unresolvedWardrobeSubtype,
    }
  }

  return {
    role: unresolvedWardrobeRole,
    subtype: unresolvedWardrobeSubtype,
    source: 'unresolved',
    resolved: false,
  } as const
}

type LabelMap = Record<string, string>

const wardrobeTaxonomyLabels: Record<
  Locale,
  {
    roles: LabelMap
    subtypes: LabelMap
    styles: LabelMap
    formality: LabelMap
    colorFamilies: LabelMap
  }
> = {
  az: {
    roles: {
      top: 'Üst geyim',
      bottom: 'Alt geyim',
      outerwear: 'Üst qat',
      one_piece: 'Bütöv geyim',
      shoes: 'Ayaqqabı',
      accessory: 'Aksesuar',
      unresolved: 'Dəqiqləşdirilməyib',
    },
    subtypes: {
      t_shirt: 'Futbolka',
      shirt: 'Köynək',
      polo: 'Polo',
      hoodie: 'Huddi',
      sweatshirt: 'Sviterşört',
      sweater: 'Sviter',
      tank_top: 'Mayka',
      blouse: 'Bluza',
      jeans: 'Cins',
      trousers: 'Şalvar',
      chinos: 'Çinos',
      shorts: 'Şort',
      joggers: 'Coqqer',
      sweatpants: 'İdman şalvarı',
      skirt: 'Ətək',
      leggings: 'Leggins',
      jacket: 'Jaket',
      coat: 'Palto',
      blazer: 'Blazer',
      cardigan: 'Kardiqan',
      overshirt: 'Üst köynək',
      vest: 'Jilet',
      dress: 'Don',
      jumpsuit: 'Kombinezon',
      suit_set: 'Kostyum dəsti',
      sneakers: 'Krossovka',
      boots: 'Çəkmə',
      loafers: 'Loafer',
      sandals: 'Sandal',
      heels: 'Dabanlı ayaqqabı',
      dress_shoes: 'Klassik ayaqqabı',
      cap: 'Kepka',
      hat: 'Şlyapa',
      belt: 'Kəmər',
      bag: 'Çanta',
      watch: 'Saat',
      scarf: 'Şərf',
      jewelry: 'Zinət əşyası',
      glasses: 'Eynək',
      unresolved: 'Dəqiqləşdirilməyib',
    },
    styles: {
      casual: 'Gündəlik',
      formal: 'Rəsmi',
      business: 'İş',
      streetwear: 'Streetwear',
      classic: 'Klassik',
      minimal: 'Minimal',
      sport: 'Sport',
      evening: 'Axşam',
      smart_casual: 'Smart casual',
      relaxed: 'Rahat',
    },
    formality: {
      relaxed: 'Rahat',
      casual: 'Gündəlik',
      smart_casual: 'Smart casual',
      business: 'İşgüzar',
      formal: 'Rəsmi',
    },
    colorFamilies: {
      black: 'Qara',
      white: 'Ağ',
      gray: 'Boz',
      navy: 'Tünd göy',
      blue: 'Göy',
      beige: 'Bej',
      brown: 'Qəhvəyi',
      green: 'Yaşıl',
      red: 'Qırmızı',
      burgundy: 'Bordo',
      pink: 'Çəhrayı',
      yellow: 'Sarı',
      orange: 'Narıncı',
      purple: 'Bənövşəyi',
    },
  },
  en: {
    roles: {
      top: 'Top',
      bottom: 'Bottom',
      outerwear: 'Outerwear',
      one_piece: 'One-piece',
      shoes: 'Shoes',
      accessory: 'Accessory',
      unresolved: 'Unresolved',
    },
    subtypes: {
      t_shirt: 'T-shirt',
      shirt: 'Shirt',
      polo: 'Polo',
      hoodie: 'Hoodie',
      sweatshirt: 'Sweatshirt',
      sweater: 'Sweater',
      tank_top: 'Tank top',
      blouse: 'Blouse',
      jeans: 'Jeans',
      trousers: 'Trousers',
      chinos: 'Chinos',
      shorts: 'Shorts',
      joggers: 'Joggers',
      sweatpants: 'Sweatpants',
      skirt: 'Skirt',
      leggings: 'Leggings',
      jacket: 'Jacket',
      coat: 'Coat',
      blazer: 'Blazer',
      cardigan: 'Cardigan',
      overshirt: 'Overshirt',
      vest: 'Vest',
      dress: 'Dress',
      jumpsuit: 'Jumpsuit',
      suit_set: 'Suit set',
      sneakers: 'Sneakers',
      boots: 'Boots',
      loafers: 'Loafers',
      sandals: 'Sandals',
      heels: 'Heels',
      dress_shoes: 'Dress shoes',
      cap: 'Cap',
      hat: 'Hat',
      belt: 'Belt',
      bag: 'Bag',
      watch: 'Watch',
      scarf: 'Scarf',
      jewelry: 'Jewelry',
      glasses: 'Glasses',
      unresolved: 'Unresolved',
    },
    styles: {
      casual: 'Casual',
      formal: 'Formal',
      business: 'Business',
      streetwear: 'Streetwear',
      classic: 'Classic',
      minimal: 'Minimal',
      sport: 'Sport',
      evening: 'Evening',
      smart_casual: 'Smart casual',
      relaxed: 'Relaxed',
    },
    formality: {
      relaxed: 'Relaxed',
      casual: 'Casual',
      smart_casual: 'Smart casual',
      business: 'Business',
      formal: 'Formal',
    },
    colorFamilies: {
      black: 'Black',
      white: 'White',
      gray: 'Gray',
      navy: 'Navy',
      blue: 'Blue',
      beige: 'Beige',
      brown: 'Brown',
      green: 'Green',
      red: 'Red',
      burgundy: 'Burgundy',
      pink: 'Pink',
      yellow: 'Yellow',
      orange: 'Orange',
      purple: 'Purple',
    },
  },
  ru: {
    roles: {
      top: 'Верх',
      bottom: 'Низ',
      outerwear: 'Верхняя одежда',
      one_piece: 'Цельный образ',
      shoes: 'Обувь',
      accessory: 'Аксессуар',
      unresolved: 'Не определено',
    },
    subtypes: {
      t_shirt: 'Футболка',
      shirt: 'Рубашка',
      polo: 'Поло',
      hoodie: 'Худи',
      sweatshirt: 'Свитшот',
      sweater: 'Свитер',
      tank_top: 'Майка',
      blouse: 'Блуза',
      jeans: 'Джинсы',
      trousers: 'Брюки',
      chinos: 'Чиносы',
      shorts: 'Шорты',
      joggers: 'Джоггеры',
      sweatpants: 'Спортивные брюки',
      skirt: 'Юбка',
      leggings: 'Леггинсы',
      jacket: 'Куртка',
      coat: 'Пальто',
      blazer: 'Блейзер',
      cardigan: 'Кардиган',
      overshirt: 'Овершерт',
      vest: 'Жилет',
      dress: 'Платье',
      jumpsuit: 'Комбинезон',
      suit_set: 'Костюм',
      sneakers: 'Кроссовки',
      boots: 'Ботинки',
      loafers: 'Лоферы',
      sandals: 'Сандалии',
      heels: 'Каблуки',
      dress_shoes: 'Классические туфли',
      cap: 'Кепка',
      hat: 'Шляпа',
      belt: 'Ремень',
      bag: 'Сумка',
      watch: 'Часы',
      scarf: 'Шарф',
      jewelry: 'Украшения',
      glasses: 'Очки',
      unresolved: 'Не определено',
    },
    styles: {
      casual: 'Повседневный',
      formal: 'Формальный',
      business: 'Деловой',
      streetwear: 'Streetwear',
      classic: 'Классический',
      minimal: 'Минимализм',
      sport: 'Спорт',
      evening: 'Вечерний',
      smart_casual: 'Smart casual',
      relaxed: 'Расслабленный',
    },
    formality: {
      relaxed: 'Расслабленный',
      casual: 'Повседневный',
      smart_casual: 'Smart casual',
      business: 'Деловой',
      formal: 'Формальный',
    },
    colorFamilies: {
      black: 'Черный',
      white: 'Белый',
      gray: 'Серый',
      navy: 'Темно-синий',
      blue: 'Синий',
      beige: 'Бежевый',
      brown: 'Коричневый',
      green: 'Зеленый',
      red: 'Красный',
      burgundy: 'Бордовый',
      pink: 'Розовый',
      yellow: 'Желтый',
      orange: 'Оранжевый',
      purple: 'Фиолетовый',
    },
  },
}

export function getWardrobeRoleLabel(locale: Locale, value: string) {
  return wardrobeTaxonomyLabels[locale].roles[value] ?? value
}

export function getWardrobeSubtypeLabel(locale: Locale, value: string) {
  return wardrobeTaxonomyLabels[locale].subtypes[value] ?? value
}

export function getWardrobeStyleTagLabel(locale: Locale, value: string) {
  return wardrobeTaxonomyLabels[locale].styles[value] ?? value
}

export function getWardrobeFormalityLabel(locale: Locale, value: string) {
  return wardrobeTaxonomyLabels[locale].formality[value] ?? value
}

export function getWardrobeColorFamilyLabel(locale: Locale, value: string) {
  return wardrobeTaxonomyLabels[locale].colorFamilies[value] ?? value
}
