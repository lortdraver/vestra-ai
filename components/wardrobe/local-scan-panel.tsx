'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ScanLine } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import {
  getWardrobeColorFamilyLabel,
  getWardrobeSubtypeLabel,
  getWardrobeStyleTagLabel,
} from '@/lib/wardrobe/taxonomy'
import {
  scanClothingImage,
  type LocalVisionProgress,
  type LocalVisionSuggestion,
} from '@/lib/wardrobe/local-vision'

const copy: Record<
  Locale,
  {
    downloading: string
    preparing: string
    scanning: string
    done: string
    failed: string
    lowConfidence: string
    privacy: string
  }
> = {
  ru: {
    downloading:
      'Загружаю модель распознавания… {loaded} / {total} МБ (только в первый раз)',
    preparing: 'Готовлю модель (только в первый раз, ~1 мин)…',
    scanning: 'Сканирую вещь…',
    done: 'Распознано: поля ниже заполнены — проверь и при необходимости поправь.',
    failed: 'Не получилось распознать вещь в браузере — заполни поля вручную.',
    lowConfidence: 'Модель не уверена — проверь тип вещи.',
    privacy: 'Работает прямо в браузере, фото не отправляется в AI-сервисы.',
  },
  en: {
    downloading:
      'Downloading the recognition model… {loaded} / {total} MB (first time only)',
    preparing: 'Preparing the model (first time only, ~1 min)…',
    scanning: 'Scanning the item…',
    done: 'Recognised: the fields below are filled in — check and adjust if needed.',
    failed:
      "Couldn't recognise the item in the browser — please fill in the fields.",
    lowConfidence: 'The model is unsure — please check the item type.',
    privacy:
      'Runs right in your browser; the photo is not sent to AI services.',
  },
  az: {
    downloading:
      'Tanıma modeli yüklənir… {loaded} / {total} MB (yalnız ilk dəfə)',
    preparing: 'Model hazırlanır (yalnız ilk dəfə, ~1 dəq)…',
    scanning: 'Əşya skan edilir…',
    done: 'Tanındı: aşağıdakı sahələr dolduruldu — yoxlayın və lazım olsa düzəldin.',
    failed: 'Əşyanı brauzerdə tanımaq alınmadı — sahələri əl ilə doldurun.',
    lowConfidence: 'Model əmin deyil — əşyanın növünü yoxlayın.',
    privacy: 'Birbaşa brauzerdə işləyir, şəkil AI xidmətlərinə göndərilmir.',
  },
}

// Hidden switch while the feature is being tested: open any page with
// ?scan=1 to turn it on in this browser, ?scan=0 to turn it off again.
const FLAG_KEY = 'vestra-local-scan'
function readScanFlag() {
  try {
    const param = new URLSearchParams(window.location.search).get('scan')
    if (param === '1') window.localStorage.setItem(FLAG_KEY, '1')
    if (param === '0') window.localStorage.removeItem(FLAG_KEY)
    return window.localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}
const subscribeToNothing = () => () => {}

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; progress: LocalVisionProgress }
  | { kind: 'done'; result: LocalVisionSuggestion }
  | { kind: 'failed' }

/**
 * Scans the selected photo with the free in-browser model and hands the
 * suggestion to the form. Renders nothing until a photo is chosen.
 */
export function LocalScanPanel({
  imageUrl,
  locale,
  onResult,
}: {
  imageUrl: string | null | undefined
  locale: Locale
  onResult: (suggestion: LocalVisionSuggestion) => void
}) {
  const enabled = useSyncExternalStore(
    subscribeToNothing,
    readScanFlag,
    () => false,
  )
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  useEffect(() => {
    if (!imageUrl || !enabled) return
    let cancelled = false
    const run = async () => {
      setStatus({ kind: 'working', progress: { stage: 'scanning' } })
      try {
        const result = await scanClothingImage(imageUrl, locale, (progress) => {
          if (!cancelled) setStatus({ kind: 'working', progress })
        })
        if (cancelled) return
        setStatus({ kind: 'done', result })
        onResultRef.current(result)
      } catch (error) {
        console.warn('[local-vision] scan failed', error)
        if (!cancelled) setStatus({ kind: 'failed' })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [imageUrl, locale, enabled])

  if (!enabled || !imageUrl || status.kind === 'idle') return null
  const t = copy[locale]

  if (status.kind === 'working') {
    const { progress } = status
    const text =
      progress.stage === 'downloading'
        ? t.downloading
            .replace('{loaded}', String(progress.loadedMb ?? 0))
            .replace('{total}', String(progress.totalMb ?? '…'))
        : progress.stage === 'preparing'
          ? t.preparing
          : t.scanning
    const pct =
      progress.stage === 'downloading' && progress.totalMb
        ? Math.min(100, ((progress.loadedMb ?? 0) / progress.totalMb) * 100)
        : null
    return (
      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <ScanLine className="size-4 animate-pulse text-accent" />
          {text}
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={
              pct === null
                ? 'h-full w-1/3 animate-pulse rounded-full bg-accent'
                : 'h-full rounded-full bg-accent transition-all'
            }
            style={pct === null ? undefined : { width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  if (status.kind === 'failed') {
    return (
      <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
        {t.failed}
      </p>
    )
  }

  const { result } = status
  const chips = [
    getWardrobeSubtypeLabel(locale, result.clothingType),
    result.material,
    ...result.colors
      .split(', ')
      .map((c) => getWardrobeColorFamilyLabel(locale, c)),
    ...result.styles.map((s) => getWardrobeStyleTagLabel(locale, s)),
  ].filter(Boolean)

  return (
    <div className="grid gap-2 rounded-xl border border-accent/40 bg-card p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <ScanLine className="size-4 text-accent" />
        {t.done}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs"
          >
            {chip}
          </span>
        ))}
      </div>
      {result.confidence < 0.5 && (
        <p className="text-xs text-accent">{t.lowConfidence}</p>
      )}
      <p className="text-xs text-muted-foreground">{t.privacy}</p>
    </div>
  )
}
