/**
 * Free, in-browser clothing recognition with Marqo-FashionSigLIP
 * (Apache-2.0) through Transformers.js. Nothing is sent to a server and no
 * paid AI is used: the model is downloaded once (~200 MB, cached by the
 * browser) and runs on WebGPU when available, otherwise on the CPU.
 *
 * Results are mapped straight onto the app's own taxonomy so they can
 * pre-fill the manual wardrobe form.
 */

import type { Locale } from '@/lib/i18n/config'

const TRANSFORMERS_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2'
const MODEL_ID = 'Marqo/marqo-fashionSigLIP'
const LABEL_CACHE_KEY = 'vestra-local-vision-labels-v1'
const TEMPLATES = [
  'a photo of {}',
  'a product photo of {}',
  '{} lying flat on the floor',
]

// [app subtype key, English descriptions]
const SUBTYPES: [string, string[]][] = [
  ['t_shirt', ['a t-shirt', 'a short sleeve tee']],
  ['shirt', ['a button-up shirt', 'a collared shirt']],
  ['polo', ['a polo shirt']],
  [
    'hoodie',
    [
      'a hoodie',
      'a hooded sweatshirt with a kangaroo pocket',
      'a pullover hoodie with drawstrings',
    ],
  ],
  ['sweatshirt', ['a crewneck sweatshirt']],
  [
    'sweater',
    ['a knit sweater', 'a knitted wool jumper', 'a pullover sweater'],
  ],
  ['tank_top', ['a tank top', 'a sleeveless top']],
  ['blouse', ['a blouse']],
  [
    'jeans',
    [
      'jeans',
      'denim jeans',
      'wide-leg baggy jeans',
      'a pair of jeans laid flat',
    ],
  ],
  ['trousers', ['trousers', 'dress pants']],
  ['chinos', ['chino pants']],
  ['shorts', ['shorts', 'denim shorts']],
  ['joggers', ['jogger pants']],
  ['sweatpants', ['sweatpants', 'track pants']],
  ['skirt', ['a skirt', 'a mini skirt', 'a pleated skirt']],
  ['leggings', ['leggings']],
  [
    'jacket',
    [
      'a jacket',
      'a zip-up jacket',
      'a bomber jacket',
      'a leather jacket',
      'a windbreaker',
      'a puffer jacket',
      'a quilted padded down jacket',
    ],
  ],
  ['coat', ['a long coat', 'a wool overcoat', 'a trench coat']],
  ['blazer', ['a blazer', 'a suit jacket']],
  ['cardigan', ['a cardigan', 'a button-up knit cardigan']],
  ['overshirt', ['an overshirt', 'a shirt jacket']],
  ['vest', ['a vest', 'a sleeveless gilet']],
  ['dress', ['a dress', 'a summer dress']],
  ['jumpsuit', ['a jumpsuit']],
  ['suit_set', ['a two-piece suit']],
  ['sneakers', ['sneakers', 'running shoes', 'low-top trainers']],
  [
    'boots',
    ['boots', 'ankle boots', 'lace-up leather work boots', 'hiking boots'],
  ],
  ['loafers', ['leather loafers']],
  ['sandals', ['sandals', 'slides']],
  ['heels', ['high heels']],
  ['dress_shoes', ['dress shoes', 'oxford shoes']],
  ['cap', ['a baseball cap']],
  ['hat', ['a beanie', 'a knit winter hat']],
  ['belt', ['a leather belt']],
  ['bag', ['a handbag', 'a tote bag']],
  ['watch', ['a wristwatch']],
  ['scarf', ['a scarf']],
  ['jewelry', ['jewelry', 'a necklace']],
  ['glasses', ['sunglasses', 'eyeglasses']],
]

const COLORS: [string, string[]][] = [
  ['black', ['black']],
  ['white', ['white']],
  ['gray', ['grey']],
  ['navy', ['navy blue']],
  ['blue', ['blue', 'light blue']],
  ['beige', ['beige', 'cream']],
  ['brown', ['brown', 'camel']],
  ['green', ['green', 'olive green']],
  ['red', ['red']],
  ['burgundy', ['burgundy']],
  ['pink', ['pink']],
  ['yellow', ['yellow']],
  ['orange', ['orange']],
  ['purple', ['purple']],
].map(([key, names]) => [
  key as string,
  (names as string[]).flatMap((n) => [`a ${n} clothing item`, `${n} clothes`]),
])

const STYLES: [string, string[]][] = [
  ['casual', ['casual everyday clothing']],
  ['formal', ['formal clothing']],
  ['business', ['business office clothing']],
  ['streetwear', ['streetwear urban clothing']],
  ['classic', ['classic timeless clothing']],
  ['minimal', ['minimalist basic clothing']],
  ['sport', ['sportswear athletic clothing']],
  ['evening', ['elegant evening clothing']],
]

const SEASONS: [string, string[]][] = [
  ['summer', ['light summer clothing for hot weather']],
  ['spring_autumn', ['light spring or autumn clothing']],
  ['winter', ['warm winter clothing for cold weather']],
  ['all', ['all-season clothing']],
]

const MATERIALS: [string, string[]][] = [
  ['leather', ['a leather jacket', 'faux leather clothing', 'smooth leather']],
  ['suede', ['suede material', 'nubuck leather']],
  ['denim', ['denim fabric', 'jeans material']],
  ['knit', ['knitted wool fabric', 'chunky knit material']],
  ['cotton', ['cotton jersey fabric', 'plain cotton fabric']],
  ['fleece', ['fleece fabric', 'soft sweatshirt fleece material']],
  ['nylon', ['nylon shell fabric', 'shiny polyester windbreaker material']],
  ['down', ['quilted down padding', 'puffer jacket quilting']],
  ['wool', ['wool coat fabric', 'felted wool']],
  ['fur', ['fur', 'faux fur', 'sherpa fleece']],
]

const MATERIAL_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    leather: 'leather / faux leather',
    suede: 'suede / nubuck',
    denim: 'denim',
    knit: 'knit',
    cotton: 'cotton',
    fleece: 'fleece',
    nylon: 'nylon / polyester',
    down: 'quilted down',
    wool: 'wool',
    fur: 'fur / sherpa',
  },
  ru: {
    leather: 'кожа / экокожа',
    suede: 'замша / нубук',
    denim: 'деним',
    knit: 'трикотаж / вязка',
    cotton: 'хлопок',
    fleece: 'флис / футер',
    nylon: 'нейлон / плащёвка',
    down: 'стёганый пух',
    wool: 'шерсть',
    fur: 'мех',
  },
  az: {
    leather: 'dəri / eko-dəri',
    suede: 'zamş / nubuk',
    denim: 'cins',
    knit: 'trikotaj / toxunma',
    cotton: 'pambıq',
    fleece: 'flis',
    nylon: 'neylon / poliester',
    down: 'tikişli pərqu',
    wool: 'yun',
    fur: 'xəz',
  },
}

const ROLE_BY_SUBTYPE: Record<string, string> = {
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

export type LocalVisionSuggestion = {
  category: string
  clothingType: string
  colors: string
  seasons: string[]
  styles: string[]
  material: string
  confidence: number
  materialKey: string
}

export type LocalVisionProgress = {
  stage: 'downloading' | 'preparing' | 'scanning'
  loadedMb?: number
  totalMb?: number
}

type Vec = Float32Array
type Model = {
  tokenizer: (texts: string[], options: object) => unknown
  processor: (image: unknown) => Promise<unknown>
  textModel: (inputs: unknown) => Promise<{ text_embeds: Tensor }>
  visionModel: (inputs: unknown) => Promise<{ image_embeds: Tensor }>
  RawImage: { fromBlob: (blob: Blob) => Promise<unknown> }
}
type Tensor = { dims: number[]; data: Float32Array }
type LabelEmbeddings = Record<
  'subtypes' | 'colors' | 'styles' | 'seasons' | 'materials',
  Vec[]
>

let modelPromise: Promise<Model> | null = null
let labelPromise: Promise<LabelEmbeddings> | null = null

function normalize(data: ArrayLike<number>): Vec {
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  const norm = Math.sqrt(sum) || 1
  return Float32Array.from(data, (v) => v / norm)
}

function rows(tensor: Tensor): Vec[] {
  const [n, d] = tensor.dims
  const out: Vec[] = []
  for (let i = 0; i < n; i++) {
    out.push(normalize(tensor.data.slice(i * d, (i + 1) * d)))
  }
  return out
}

function dot(a: Vec, b: Vec) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

function softmax(values: number[]) {
  const max = Math.max(...values)
  const exps = values.map((v) => Math.exp(v - max))
  const total = exps.reduce((a, b) => a + b, 0)
  return exps.map((v) => v / total)
}

function loadModel(onProgress?: (p: LocalVisionProgress) => void) {
  if (modelPromise) return modelPromise
  modelPromise = (async () => {
    const lib = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ TRANSFORMERS_URL
    )
    lib.env.allowLocalModels = false
    const files = new Map<string, [number, number]>()
    const progress_callback = (p: {
      status: string
      file?: string
      loaded?: number
      total?: number
    }) => {
      if (p.status !== 'progress' || !p.total || !p.file) return
      files.set(p.file, [p.loaded ?? 0, p.total])
      let loaded = 0
      let total = 0
      for (const [l, t] of files.values()) {
        loaded += l
        total += t
      }
      onProgress?.({
        stage: 'downloading',
        loadedMb: Math.round(loaded / 1e6),
        totalMb: Math.round(total / 1e6),
      })
    }
    const nav = navigator as Navigator & { gpu?: unknown }
    const device = nav.gpu ? 'webgpu' : 'wasm'
    const [tokenizer, processor] = await Promise.all([
      lib.AutoTokenizer.from_pretrained(MODEL_ID),
      lib.AutoProcessor.from_pretrained(MODEL_ID),
    ])
    let textModel
    let visionModel
    try {
      const opts = { device, dtype: 'q8', progress_callback }
      textModel = await lib.SiglipTextModel.from_pretrained(MODEL_ID, opts)
      visionModel = await lib.SiglipVisionModel.from_pretrained(MODEL_ID, opts)
    } catch {
      const opts = { device: 'wasm', dtype: 'q8', progress_callback }
      textModel = await lib.SiglipTextModel.from_pretrained(MODEL_ID, opts)
      visionModel = await lib.SiglipVisionModel.from_pretrained(MODEL_ID, opts)
    }
    return {
      tokenizer,
      processor,
      textModel,
      visionModel,
      RawImage: lib.RawImage,
    } as Model
  })()
  modelPromise.catch(() => {
    modelPromise = null
  })
  return modelPromise
}

async function classEmbeddings(
  model: Model,
  classes: [string, string[]][],
  useTemplates: boolean,
) {
  const texts: string[] = []
  const owner: number[] = []
  classes.forEach(([, descriptions], ci) => {
    for (const d of descriptions) {
      for (const t of useTemplates ? TEMPLATES : ['{}']) {
        texts.push(t.replace('{}', d))
        owner.push(ci)
      }
    }
  })
  const embeddings: Vec[] = []
  for (let i = 0; i < texts.length; i += 32) {
    const inputs = model.tokenizer(texts.slice(i, i + 32), {
      padding: 'max_length',
      truncation: true,
      max_length: 64,
    })
    embeddings.push(...rows((await model.textModel(inputs)).text_embeds))
  }
  const sums = classes.map(() => new Float32Array(embeddings[0].length))
  embeddings.forEach((e, i) => {
    const s = sums[owner[i]]
    for (let k = 0; k < e.length; k++) s[k] += e[k]
  })
  return sums.map(normalize)
}

function loadLabels(
  model: Model,
  onProgress?: (p: LocalVisionProgress) => void,
) {
  if (labelPromise) return labelPromise
  labelPromise = (async () => {
    try {
      const cached = window.localStorage.getItem(LABEL_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, number[][]>
        return Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [
            k,
            v.map((row) => Float32Array.from(row)),
          ]),
        ) as LabelEmbeddings
      }
    } catch {
      // ignore broken cache
    }
    onProgress?.({ stage: 'preparing' })
    const labels: LabelEmbeddings = {
      subtypes: await classEmbeddings(model, SUBTYPES, true),
      colors: await classEmbeddings(model, COLORS, false),
      styles: await classEmbeddings(model, STYLES, true),
      seasons: await classEmbeddings(model, SEASONS, true),
      materials: await classEmbeddings(model, MATERIALS, false),
    }
    try {
      window.localStorage.setItem(
        LABEL_CACHE_KEY,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(labels).map(([k, v]) => [
              k,
              v.map((row) => Array.from(row, (x) => +x.toFixed(5))),
            ]),
          ),
        ),
      )
    } catch {
      // storage full or unavailable: labels are recomputed next time
    }
    return labels
  })()
  labelPromise.catch(() => {
    labelPromise = null
  })
  return labelPromise
}

function rank(labels: Vec[], image: Vec) {
  return softmax(labels.map((l) => 100 * dot(l, image)))
}

function top(keys: [string, string[]][], probs: number[], minShare = 0) {
  const best = Math.max(...probs)
  return keys
    .map(([key], i) => ({ key, p: probs[i] }))
    .filter((x) => x.p === best || x.p >= best * minShare)
    .sort((a, b) => b.p - a.p)
}

/** Recognises a clothing photo in the browser. */
export async function scanClothingImage(
  photo: Blob,
  locale: Locale,
  onProgress?: (p: LocalVisionProgress) => void,
): Promise<LocalVisionSuggestion> {
  const model = await loadModel(onProgress)
  const labels = await loadLabels(model, onProgress)
  onProgress?.({ stage: 'scanning' })

  const image = await model.RawImage.fromBlob(photo)
  const inputs = await model.processor(image)
  const vec = rows((await model.visionModel(inputs)).image_embeds)[0]

  const subtype = top(SUBTYPES, rank(labels.subtypes, vec))[0]
  const colors = top(COLORS, rank(labels.colors, vec), 0.5).slice(0, 2)
  const styles = top(STYLES, rank(labels.styles, vec), 0.6).slice(0, 2)
  const season = top(SEASONS, rank(labels.seasons, vec))[0].key
  const material = top(MATERIALS, rank(labels.materials, vec))[0].key

  const seasons =
    season === 'all'
      ? ['spring', 'summer', 'autumn', 'winter']
      : season === 'spring_autumn'
        ? ['spring', 'autumn']
        : [season]

  return {
    category: ROLE_BY_SUBTYPE[subtype.key] ?? 'top',
    clothingType: subtype.key,
    colors: colors.map((c) => c.key).join(', '),
    seasons,
    styles: styles.map((s) => s.key),
    material: MATERIAL_LABELS[locale][material] ?? material,
    materialKey: material,
    confidence: subtype.p,
  }
}
