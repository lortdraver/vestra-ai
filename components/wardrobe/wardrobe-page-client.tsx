'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Brain,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Edit,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiErrorCode } from '@/lib/api/errors'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { WardrobeInsightsDto, WearLogDto } from '@/lib/wear'
import {
  wardrobeCategories,
  wardrobeSeasons,
  wardrobeStyles,
} from '@/lib/wardrobe/constants'
import {
  compressWardrobeImage,
  extractWardrobeImageColors,
  type WardrobeImageColorHints,
} from '@/lib/wardrobe/image-compression'
import type { WardrobeItemDto } from '@/lib/wardrobe/types'
import { cn } from '@/lib/utils'

type WardrobeSaveErrorCode =
  | 'unauthorized'
  | 'missing_required_fields'
  | 'invalid_category'
  | 'missing_image'
  | 'invalid_image_type'
  | 'image_too_large'
  | 'background_removal_not_configured'
  | 'storage_not_configured'
  | 'storage_write_failed'
  | 'database_schema_mismatch'
  | 'database_write_failed'
  | 'upload_failed'

type AnalysisErrorCode =
  | 'ai_provider_invalid_request'
  | 'ai_provider_invalid_api_key'
  | 'ai_provider_insufficient_credits'
  | 'ai_provider_forbidden'
  | 'ai_provider_not_found'
  | 'ai_provider_timeout'
  | 'ai_provider_rate_limited'
  | 'ai_provider_unavailable'
  | 'ai_provider_local_image_data_url_missing'
  | 'ai_credentials_missing'
  | 'analysis_failed'

type FormState = {
  name: string
  category: string
  clothingType: string
  colors: string
  seasons: string[]
  styles: string[]
  material: string
  brand: string
  notes: string
}

type AnalysisCorrectionState = {
  detectedClothingType: string
  detectedCategory: string
  colors: string
  season: string
  style: string
  material: string
  fit: string
  pattern: string
  brandGuess: string
  visualDescription: string
  warmthLevel: string
  formalityLevel: string
  confidenceScore: string
  dominantHexColors: string
}

type ImagePreviewState = {
  url: string
  name: string
  size: number
  width: number | null
  height: number | null
}

const emptyForm: FormState = {
  name: '',
  category: 'tops',
  clothingType: '',
  colors: '',
  seasons: [],
  styles: [],
  material: '',
  brand: '',
  notes: '',
}

const emptyCorrections: AnalysisCorrectionState = {
  detectedClothingType: '',
  detectedCategory: 'tops',
  colors: '',
  season: '',
  style: '',
  material: '',
  fit: '',
  pattern: '',
  brandGuess: '',
  visualDescription: '',
  warmthLevel: '',
  formalityLevel: '',
  confidenceScore: '',
  dominantHexColors: '',
}

function listToText(values: string[]) {
  return values.join(', ')
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function getOptionLabel(labels: Record<string, string>, value: string) {
  return labels[value] ?? value
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDimensions(preview: ImagePreviewState) {
  if (!preview.width || !preview.height) return null

  return `${preview.width} x ${preview.height}px`
}

function isWardrobeSaveErrorCode(
  error: ApiErrorCode | undefined,
): error is WardrobeSaveErrorCode {
  return Boolean(
    error &&
    [
      'unauthorized',
      'missing_required_fields',
      'invalid_category',
      'missing_image',
      'invalid_image_type',
      'image_too_large',
      'background_removal_not_configured',
      'storage_not_configured',
      'storage_write_failed',
      'database_schema_mismatch',
      'database_write_failed',
      'upload_failed',
    ].includes(error),
  )
}

async function readApiError(
  response: Response,
): Promise<{ error: WardrobeSaveErrorCode; detail?: string } | null> {
  const data = (await response.json().catch(() => null)) as {
    error?: ApiErrorCode
    detail?: string
  } | null

  return isWardrobeSaveErrorCode(data?.error)
    ? { error: data.error, detail: data.detail }
    : null
}

function getAnalysisErrorMessage(
  dictionary: Dictionary,
  error?: string | null,
) {
  const messages = dictionary.wardrobe.analysis.errors

  switch (error as AnalysisErrorCode | undefined) {
    case 'ai_provider_invalid_request':
      return messages.providerInvalidRequest
    case 'ai_provider_invalid_api_key':
      return messages.providerInvalidApiKey
    case 'ai_provider_insufficient_credits':
      return messages.providerInsufficientCredits
    case 'ai_provider_forbidden':
      return messages.providerForbidden
    case 'ai_provider_not_found':
      return messages.providerNotFound
    case 'ai_provider_timeout':
      return messages.providerTimeout
    case 'ai_provider_rate_limited':
      return messages.providerRateLimited
    case 'ai_provider_unavailable':
      return messages.providerUnavailable
    case 'ai_provider_local_image_data_url_missing':
      return messages.localImageDataMissing
    case 'ai_credentials_missing':
      return messages.aiCredentialsMissing
    default:
      return messages.analyze
  }
}

function getClientTimeMs() {
  return performance.now()
}

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function toDateInputValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

function dateInputToIso(value: string) {
  if (!value) return new Date().toISOString()
  return new Date(`${value}T12:00:00`).toISOString()
}

function formatLocalDate(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  )
}

function makeWearIdempotencyKey(scope: string) {
  return `${scope}:${Date.now()}:${crypto.randomUUID()}`
}

export function WardrobePageClient({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.wardrobe
  const [items, setItems] = useState<WardrobeItemDto[]>([])
  const [selectedItem, setSelectedItem] = useState<WardrobeItemDto | null>(null)
  const [editingItem, setEditingItem] = useState<WardrobeItemDto | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<ImagePreviewState | null>(
    null,
  )
  const [imageColorHints, setImageColorHints] =
    useState<WardrobeImageColorHints | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [seasonFilter, setSeasonFilter] = useState('')
  const [styleFilter, setStyleFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [advancedManualMode, setAdvancedManualMode] = useState(false)
  const [processingStepIndex, setProcessingStepIndex] = useState(0)
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null)
  const [isSavingCorrections, setIsSavingCorrections] = useState(false)
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [wearSubmittingIds, setWearSubmittingIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [latestWearLog, setLatestWearLog] = useState<WearLogDto | null>(null)
  const [wearDate, setWearDate] = useState(() => toDateInputValue())
  const [wearNote, setWearNote] = useState('')
  const [insightsRange, setInsightsRange] =
    useState<WardrobeInsightsDto['range']>('30')
  const [insights, setInsights] = useState<WardrobeInsightsDto | null>(null)
  const [dismissedInsightItemIds, setDismissedInsightItemIds] = useState<
    Set<string>
  >(() => new Set())
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [corrections, setCorrections] =
    useState<AnalysisCorrectionState>(emptyCorrections)
  const [error, setError] = useState<string | null>(null)
  const analysisRequestIdsRef = useRef<Set<string>>(new Set())

  const processingSteps = [
    t.processing.steps.uploading,
    t.processing.steps.detecting,
    t.processing.steps.removing,
    t.processing.steps.analyzing,
    t.processing.steps.optimizing,
    t.processing.steps.saving,
  ]
  const showManualFields = Boolean(editingItem) || advancedManualMode

  const fetchItems = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      if (seasonFilter) params.set('season', seasonFilter)
      if (styleFilter) params.set('style', styleFilter)

      const response = await fetch(`/api/wardrobe/items?${params.toString()}`)
      if (!response.ok) throw new Error('load_failed')

      const data = (await response.json()) as { items: WardrobeItemDto[] }
      setItems(data.items)
    } catch {
      setError(t.errors.load)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInsights = async () => {
    try {
      const response = await fetch(
        `/api/wardrobe/insights?range=${insightsRange}`,
      )
      if (!response.ok) return
      const data = (await response.json()) as { insights: WardrobeInsightsDto }
      setInsights(data.insights)
    } catch {
      // Insights are secondary; keep wardrobe usable if this request fails.
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchItems()
    }, 250)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, seasonFilter, styleFilter])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchInsights()
    }, 0)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insightsRange])

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview.url)
      }
    }
  }, [imagePreview])

  useEffect(() => {
    if (!isSubmitting || editingItem) {
      return
    }

    const interval = window.setInterval(() => {
      setProcessingStepIndex((current) =>
        Math.min(current + 1, processingSteps.length - 1),
      )
    }, 1200)

    return () => window.clearInterval(interval)
  }, [editingItem, isSubmitting, processingSteps.length])

  useEffect(() => {
    if (!toastMessage) return

    const timeout = window.setTimeout(() => setToastMessage(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  const visibleCountLabel = useMemo(
    () => t.itemCount.replace('{count}', String(items.length)),
    [items.length, t.itemCount],
  )
  const hasActiveFilters = Boolean(
    search || categoryFilter || seasonFilter || styleFilter,
  )
  const showEmptyState = !error && items.length === 0

  const resetForm = () => {
    setForm(emptyForm)
    setImageFile(null)
    setImagePreview(null)
    setImageColorHints(null)
    setEditingItem(null)
    setAdvancedManualMode(false)
  }

  const startEdit = (item: WardrobeItemDto) => {
    setEditingItem(item)
    setAdvancedManualMode(true)
    setSelectedItem(item)
    setImageFile(null)
    setImagePreview(null)
    setImageColorHints(null)
    setForm({
      name: item.name,
      category: item.category,
      clothingType: item.clothingType,
      colors: listToText(item.colors),
      seasons: item.seasons,
      styles: item.styles,
      material: item.material,
      brand: item.brand,
      notes: item.notes,
    })
  }

  const selectItem = (item: WardrobeItemDto) => {
    setSelectedItem(item)
    const analysis = item.effectiveAnalysis
    setCorrections(
      analysis
        ? {
            detectedClothingType: analysis.detectedClothingType,
            detectedCategory: analysis.detectedCategory,
            colors: listToText(analysis.colors),
            season: listToText(analysis.season),
            style: listToText(analysis.style),
            material: analysis.material,
            fit: analysis.fit,
            pattern: analysis.pattern,
            brandGuess: analysis.brandGuess,
            visualDescription: analysis.visualDescription,
            warmthLevel: String(analysis.warmthLevel),
            formalityLevel: String(analysis.formalityLevel),
            confidenceScore: String(analysis.confidenceScore),
            dominantHexColors: listToText(analysis.dominantHexColors),
          }
        : emptyCorrections,
    )
  }

  const handleImageChange = async (file: File | null) => {
    setError(null)
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      setImageColorHints(null)
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setImagePreview({
      url: previewUrl,
      name: file.name,
      size: file.size,
      width: null,
      height: null,
    })

    const image = new window.Image()
    image.onload = () => {
      setImagePreview((current) =>
        current?.url === previewUrl
          ? {
              ...current,
              width: image.naturalWidth,
              height: image.naturalHeight,
            }
          : current,
      )
    }
    image.src = previewUrl

    setIsCompressing(true)
    try {
      const [compressedFile, colorHints] = await Promise.all([
        compressWardrobeImage(file),
        extractWardrobeImageColors(file).catch(() => null),
      ])
      setImageFile(compressedFile)
      setImageColorHints(colorHints)
    } catch {
      setError(t.errors.compress)
    } finally {
      setIsCompressing(false)
    }
  }

  const buildFormData = () => {
    const isAiFirstCreate = !editingItem && !advancedManualMode
    const formData = new FormData()
    formData.set('name', form.name.trim() || t.upload.defaultName)
    formData.set('category', isAiFirstCreate ? 'other' : form.category)
    formData.set(
      'clothingType',
      isAiFirstCreate ? t.upload.pendingClothingType : form.clothingType,
    )
    formData.set(
      'colors',
      isAiFirstCreate ? (imageColorHints?.colors.join(',') ?? '') : form.colors,
    )
    formData.set('seasons', isAiFirstCreate ? '' : form.seasons.join(','))
    formData.set('styles', isAiFirstCreate ? '' : form.styles.join(','))
    formData.set('material', isAiFirstCreate ? '' : form.material)
    formData.set('brand', isAiFirstCreate ? '' : form.brand)
    formData.set('notes', form.notes)
    if (imageColorHints) {
      formData.set('imageColorHints', JSON.stringify(imageColorHints))
    }
    if (imageFile) formData.set('image', imageFile)
    return formData
  }

  const runAnalysisInBackground = async (
    item: WardrobeItemDto,
    options?: {
      createCompletedAt?: number
      showErrors?: boolean
    },
  ) => {
    if (analysisRequestIdsRef.current.has(item.id)) return

    const requestStartedAt = getClientTimeMs()
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[dev] Wardrobe frontend analysis request starting', {
        itemId: item.id,
        delayAfterCreateMs: options?.createCompletedAt
          ? Math.round(requestStartedAt - options.createCompletedAt)
          : null,
      })
    }

    analysisRequestIdsRef.current.add(item.id)
    setAnalyzingItemId(item.id)
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, analysisStatus: 'analyzing' }
          : entry,
      ),
    )

    try {
      const response = await fetch(`/api/wardrobe/items/${item.id}/analysis`, {
        method: 'POST',
      })
      const data = (await response.json()) as {
        item?: WardrobeItemDto
        error?: string
      }
      if (!response.ok && options?.showErrors) {
        setError(getAnalysisErrorMessage(dictionary, data.error))
      }
      if (data.item) {
        replaceItem(data.item)
        return
      }
      if (!response.ok) void fetchItems()
    } catch {
      if (options?.showErrors) setError(t.analysis.errors.analyze)
      void fetchItems()
    } finally {
      analysisRequestIdsRef.current.delete(item.id)
      setAnalyzingItemId(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!editingItem && !imageFile) {
      setError(t.errors.imageRequired)
      return
    }

    setIsSubmitting(true)
    setProcessingStepIndex(0)
    try {
      const requestStartedAt = getClientTimeMs()
      const response = await fetch(
        editingItem
          ? `/api/wardrobe/items/${editingItem.id}`
          : '/api/wardrobe/items',
        {
          method: editingItem ? 'PATCH' : 'POST',
          body: buildFormData(),
        },
      )

      if (!response.ok) {
        const apiError = await readApiError(response)
        const message = apiError ? t.errors[apiError.error] : t.errors.save
        setError(
          apiError?.detail && process.env.NODE_ENV !== 'production'
            ? `${message} (${apiError.detail})`
            : message,
        )
        return
      }

      const data = (await response.json()) as { item: WardrobeItemDto }
      const itemCreationCompletedAt = getClientTimeMs()
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[dev] Wardrobe frontend item creation completed', {
          itemId: data.item.id,
          durationMs: Math.round(itemCreationCompletedAt - requestStartedAt),
          mode: editingItem ? 'edit' : 'create',
        })
      }
      const savedItem = editingItem
        ? data.item
        : { ...data.item, analysisStatus: 'analyzing' as const }
      setProcessingStepIndex(processingSteps.length - 1)
      setItems((current) =>
        editingItem
          ? current.map((item) => (item.id === savedItem.id ? savedItem : item))
          : [savedItem, ...current],
      )
      selectItem(savedItem)
      resetForm()
      setToastMessage(editingItem ? t.toast.updated : t.toast.created)
      if (!editingItem) {
        window.setTimeout(() => {
          void runAnalysisInBackground(data.item, {
            createCompletedAt: itemCreationCompletedAt,
          })
        }, 0)
      }
    } catch {
      setError(t.errors.save)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (item: WardrobeItemDto) => {
    setError(null)
    try {
      const response = await fetch(`/api/wardrobe/items/${item.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('delete_failed')

      setItems((current) => current.filter((entry) => entry.id !== item.id))
      if (selectedItem?.id === item.id) setSelectedItem(null)
      if (editingItem?.id === item.id) resetForm()
      setToastMessage(t.toast.deleted)
    } catch {
      setError(t.errors.delete)
    }
  }

  const recordWear = async (
    item: WardrobeItemDto,
    options?: { wornAt?: string; note?: string },
  ) => {
    if (wearSubmittingIds.has(item.id)) return
    setError(null)
    setWearSubmittingIds((current) => new Set(current).add(item.id))

    try {
      const response = await fetch('/api/wear-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wardrobeItemId: item.id,
          wornAt: options?.wornAt ?? new Date().toISOString(),
          note: options?.note || undefined,
          timezone: getBrowserTimezone(),
          idempotencyKey: makeWearIdempotencyKey(item.id),
        }),
      })
      const data = (await response.json()) as {
        wearLog?: WearLogDto
        message?: string
      }
      if (!response.ok || !data.wearLog) throw new Error('wear_failed')

      setLatestWearLog(data.wearLog)
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                lastWornAt: data.wearLog?.wornAt ?? entry.lastWornAt,
                wearCount: entry.wearCount + 1,
                neverWorn: false,
                unusedDays: 0,
                longUnusedStatus: null,
              }
            : entry,
        ),
      )
      setSelectedItem((current) =>
        current?.id === item.id
          ? {
              ...current,
              lastWornAt: data.wearLog?.wornAt ?? current.lastWornAt,
              wearCount: current.wearCount + 1,
              neverWorn: false,
              unusedDays: 0,
              longUnusedStatus: null,
            }
          : current,
      )
      setWearNote('')
      setToastMessage(data.message ?? dictionary.wear.toast.recorded)
      void fetchInsights()
    } catch {
      setError(dictionary.wear.errors.wear_log_write_failed)
    } finally {
      setWearSubmittingIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
    }
  }

  const undoLatestWearLog = async () => {
    if (!latestWearLog) return
    const response = await fetch(`/api/wear-logs/${latestWearLog.id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      setError(dictionary.wear.errors.not_found)
      return
    }

    const wornItemIds = new Set(
      latestWearLog.items.map((item) => item.wardrobeItemId),
    )
    setItems((current) =>
      current.map((item) =>
        wornItemIds.has(item.id)
          ? {
              ...item,
              wearCount: Math.max(item.wearCount - 1, 0),
              neverWorn: item.wearCount <= 1,
            }
          : item,
      ),
    )
    setLatestWearLog(null)
    setToastMessage(dictionary.wear.toast.undone)
    void fetchItems()
    void fetchInsights()
  }

  const replaceItem = (updatedItem: WardrobeItemDto) => {
    setItems((current) =>
      current.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
    )
    setSelectedItem((current) =>
      current?.id === updatedItem.id ? updatedItem : current,
    )
  }

  const triggerAnalysis = async (item: WardrobeItemDto) => {
    setError(null)
    await runAnalysisInBackground(item, { showErrors: true })
  }

  const saveCorrections = async (item: WardrobeItemDto) => {
    setError(null)
    setIsSavingCorrections(true)

    try {
      const body = {
        detectedClothingType: corrections.detectedClothingType || undefined,
        detectedCategory: corrections.detectedCategory || undefined,
        colors: corrections.colors
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
        season: corrections.season
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
        style: corrections.style
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
        material: corrections.material || undefined,
        fit: corrections.fit || undefined,
        pattern: corrections.pattern || undefined,
        brandGuess: corrections.brandGuess || undefined,
        visualDescription: corrections.visualDescription || undefined,
        warmthLevel: corrections.warmthLevel
          ? Number(corrections.warmthLevel)
          : undefined,
        formalityLevel: corrections.formalityLevel
          ? Number(corrections.formalityLevel)
          : undefined,
        confidenceScore: corrections.confidenceScore
          ? Number(corrections.confidenceScore)
          : undefined,
        dominantHexColors: corrections.dominantHexColors
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      }

      const response = await fetch(`/api/wardrobe/items/${item.id}/analysis`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('correction_failed')

      const data = (await response.json()) as { item: WardrobeItemDto }
      replaceItem(data.item)
      setToastMessage(t.toast.correctionsSaved)
    } catch {
      setError(t.analysis.errors.correct)
    } finally {
      setIsSavingCorrections(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <section className="rounded-xl border border-foreground/10 bg-card/95 p-4 shadow-sm lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              <Sparkles className="size-3.5" />
              {t.upload.eyebrow}
            </p>
            <h1 className="font-serif text-2xl font-medium tracking-tight">
              {editingItem ? t.upload.editTitle : t.upload.title}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {editingItem ? t.upload.editSubtitle : t.upload.subtitle}
            </p>
          </div>
          {editingItem && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t.actions.cancelEdit}
              onClick={resetForm}
            >
              <X />
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="image">{t.fields.image}</Label>
            <label className="group grid cursor-pointer place-items-center rounded-xl border border-dashed border-foreground/20 bg-muted/40 px-4 py-6 text-center transition hover:border-foreground/50 hover:bg-muted/70">
              <Upload className="mb-2 size-7 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:text-foreground" />
              <span className="text-sm font-medium">{t.upload.dropTitle}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {t.upload.dropSubtitle}
              </span>
              <Input
                id="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) =>
                  void handleImageChange(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <p className="text-xs text-muted-foreground">
              {isCompressing
                ? t.states.compressing
                : imageFile
                  ? t.states.imageReady
                  : t.help.image}
            </p>
            {imagePreview && (
              <div className="overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-sm">
                <div className="aspect-[4/3] bg-[radial-gradient(circle_at_top,_var(--muted),_transparent_55%),linear-gradient(135deg,_var(--background),_var(--muted))]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview.url}
                    alt={t.preview.alt}
                    className="size-full object-contain"
                  />
                </div>
                <div className="grid gap-1 px-3 py-2 text-xs text-muted-foreground">
                  <p className="truncate font-medium text-foreground">
                    {imagePreview.name}
                  </p>
                  <p>
                    {t.preview.fileSize.replace(
                      '{size}',
                      formatBytes(imagePreview.size),
                    )}
                  </p>
                  {formatDimensions(imagePreview) ? (
                    <p>
                      {t.preview.dimensions.replace(
                        '{dimensions}',
                        formatDimensions(imagePreview) ?? '',
                      )}
                    </p>
                  ) : (
                    <div
                      className="h-3 w-28 animate-pulse rounded bg-muted"
                      aria-label={t.preview.reading}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Field
              id="name"
              label={t.fields.name}
              placeholder={t.upload.optionalNamePlaceholder}
              value={form.name}
              onChange={(value) =>
                setForm((current) => ({ ...current, name: value }))
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">{t.fields.notes}</Label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder={t.upload.optionalNotesPlaceholder}
              className="min-h-20 rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
            />
          </div>

          {!editingItem && (
            <button
              type="button"
              className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              onClick={() => setAdvancedManualMode((current) => !current)}
            >
              <SlidersHorizontal className="size-4" />
              {advancedManualMode
                ? t.upload.hideManualMode
                : t.upload.showManualMode}
            </button>
          )}

          {showManualFields && (
            <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">{t.upload.manualTitle}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="grid gap-2">
                  <Label htmlFor="category">{t.fields.category}</Label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    {wardrobeCategories.map((category) => (
                      <option key={category} value={category}>
                        {t.options.categories[category]}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  id="clothingType"
                  label={t.fields.clothingType}
                  value={form.clothingType}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      clothingType: value,
                    }))
                  }
                  required={showManualFields}
                />
                <Field
                  id="colors"
                  label={t.fields.colors}
                  value={form.colors}
                  placeholder={t.help.colors}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, colors: value }))
                  }
                />
                <Field
                  id="material"
                  label={t.fields.material}
                  value={form.material}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, material: value }))
                  }
                />
                <Field
                  id="brand"
                  label={t.fields.brand}
                  value={form.brand}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, brand: value }))
                  }
                />
              </div>

              <CheckboxGroup
                label={t.fields.season}
                values={wardrobeSeasons}
                selected={form.seasons}
                labels={t.options.seasons}
                onToggle={(value) =>
                  setForm((current) => ({
                    ...current,
                    seasons: toggleValue(current.seasons, value),
                  }))
                }
              />

              <CheckboxGroup
                label={t.fields.style}
                values={wardrobeStyles}
                selected={form.styles}
                labels={t.options.styles}
                onToggle={(value) =>
                  setForm((current) => ({
                    ...current,
                    styles: toggleValue(current.styles, value),
                  }))
                }
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting || isCompressing}>
            {editingItem ? <Edit /> : <Sparkles />}
            {isSubmitting
              ? dictionary.common.loading
              : editingItem
                ? t.actions.save
                : t.upload.analyzeAndSave}
          </Button>
        </form>
      </section>

      <section className="grid gap-4">
        <InsightsPanel
          dictionary={dictionary}
          insights={insights}
          range={insightsRange}
          dismissedItemIds={dismissedInsightItemIds}
          onRangeChange={setInsightsRange}
          onDismissItem={(itemId) =>
            setDismissedInsightItemIds((current) =>
              new Set(current).add(itemId),
            )
          }
        />

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="pl-8"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            aria-label={t.filters.category}
          >
            <option value="">{t.filters.allCategories}</option>
            {wardrobeCategories.map((category) => (
              <option key={category} value={category}>
                {t.options.categories[category]}
              </option>
            ))}
          </select>
          <select
            value={seasonFilter}
            onChange={(event) => setSeasonFilter(event.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            aria-label={t.filters.season}
          >
            <option value="">{t.filters.allSeasons}</option>
            {wardrobeSeasons.map((season) => (
              <option key={season} value={season}>
                {t.options.seasons[season]}
              </option>
            ))}
          </select>
          <select
            value={styleFilter}
            onChange={(event) => setStyleFilter(event.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            aria-label={t.filters.style}
          >
            <option value="">{t.filters.allStyles}</option>
            {wardrobeStyles.map((style) => (
              <option key={style} value={style}>
                {t.options.styles[style]}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">{visibleCountLabel}</p>
        </div>

        {items.length === 0 && !isLoading && !hasActiveFilters && !error && (
          <OnboardingPanel dictionary={dictionary} />
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-72 animate-pulse rounded-lg bg-muted"
                aria-label={t.states.loading}
              />
            ))}
          </div>
        ) : showEmptyState ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
            <Upload className="mb-3 size-8 text-muted-foreground" />
            <h2 className="font-serif text-xl font-medium">{t.empty.title}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {hasActiveFilters ? t.empty.filtered : t.empty.body}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <Card
                key={item.id}
                className="group relative rounded-xl border-foreground/10 bg-card/95 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => selectItem(item)}
                  className="aspect-[4/5] overflow-hidden bg-[linear-gradient(135deg,_var(--muted),_var(--background))] text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.processedImageUrl}
                    alt={item.name}
                    className="size-full object-contain p-4 transition duration-500 group-hover:scale-105"
                  />
                </button>
                <button
                  type="button"
                  aria-label={
                    favoriteItemIds.has(item.id)
                      ? t.card.removeFavorite
                      : t.card.addFavorite
                  }
                  onClick={() =>
                    setFavoriteItemIds((current) => {
                      const next = new Set(current)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      setToastMessage(
                        next.has(item.id)
                          ? t.toast.favoriteAdded
                          : t.toast.favoriteRemoved,
                      )
                      return next
                    })
                  }
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-foreground/10 bg-background/85 text-foreground shadow-sm backdrop-blur transition hover:scale-105"
                >
                  <Heart
                    className={cn(
                      'size-4',
                      favoriteItemIds.has(item.id) &&
                        'fill-foreground text-foreground',
                    )}
                  />
                </button>
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-background/85 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur">
                    {t.card.status[getDisplayStatus(item)]}
                  </span>
                </div>
                <CardContent className="grid gap-3">
                  <div>
                    <h2 className="font-medium">{item.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {getOptionLabel(
                        t.options.categories,
                        item.effectiveAnalysis?.detectedCategory ??
                          item.category,
                      )}
                      {' · '}
                      {item.effectiveAnalysis?.detectedClothingType ??
                        item.clothingType}
                    </p>
                  </div>
                  {item.effectiveAnalysis?.confidenceScore !== undefined && (
                    <ConfidenceMeter
                      label={t.card.confidence}
                      value={item.effectiveAnalysis.confidenceScore}
                    />
                  )}
                  <TagList
                    values={[
                      ...(item.effectiveAnalysis?.dominantHexColors ?? []),
                      ...(item.effectiveAnalysis?.colors ?? item.colors),
                      ...(item.effectiveAnalysis?.season ?? item.seasons),
                      ...(item.effectiveAnalysis?.style ?? item.styles),
                    ]}
                  />
                  <AnalysisStatusBadge
                    label={t.analysis.status[item.analysisStatus]}
                    status={item.analysisStatus}
                  />
                  <WearSummary dictionary={dictionary} item={item} />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={wearSubmittingIds.has(item.id)}
                      onClick={() => void recordWear(item)}
                    >
                      <Check />
                      {wearSubmittingIds.has(item.id)
                        ? dictionary.common.loading
                        : dictionary.wear.actions.woreThis}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => startEdit(item)}
                    >
                      <Edit />
                      {t.actions.edit}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void handleDelete(item)}
                    >
                      <Trash2 />
                      {t.actions.delete}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {selectedItem && (
        <aside className="lg:col-start-2 rounded-xl border border-foreground/10 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                <Sparkles className="size-3.5" />
                {t.analysis.resultLabel}
              </p>
              <h2 className="font-serif text-xl font-medium">
                {selectedItem.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedItem.effectiveAnalysis?.detectedClothingType ??
                  selectedItem.clothingType}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t.actions.closeDetails}
              onClick={() => setSelectedItem(null)}
            >
              <X />
            </Button>
          </div>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <Detail label={t.fields.category} value={selectedItem.category} />
            <Detail
              label={t.fields.colors}
              value={listToText(selectedItem.colors)}
            />
            <Detail
              label={t.fields.season}
              value={listToText(selectedItem.seasons)}
            />
            <Detail
              label={t.fields.style}
              value={listToText(selectedItem.styles)}
            />
            <Detail label={t.fields.material} value={selectedItem.material} />
            <Detail label={t.fields.brand} value={selectedItem.brand} />
            <Detail label={t.fields.notes} value={selectedItem.notes} wide />
          </dl>
          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <WearSummary dictionary={dictionary} item={selectedItem} />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="wearDate">
                  {dictionary.wear.fields.wornAt}
                </Label>
                <Input
                  id="wearDate"
                  type="date"
                  value={wearDate}
                  onChange={(event) => setWearDate(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wearNote">{dictionary.wear.fields.note}</Label>
                <Input
                  id="wearNote"
                  value={wearNote}
                  placeholder={dictionary.wear.fields.notePlaceholder}
                  onChange={(event) => setWearNote(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={wearSubmittingIds.has(selectedItem.id)}
                onClick={() =>
                  void recordWear(selectedItem, {
                    wornAt: dateInputToIso(wearDate),
                    note: wearNote,
                  })
                }
              >
                <Check />
                {dictionary.wear.actions.woreThis}
              </Button>
              {latestWearLog && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={undoLatestWearLog}
                >
                  <RefreshCw />
                  {dictionary.wear.actions.undo}
                </Button>
              )}
            </div>
          </div>
          <AnalysisPanel
            dictionary={dictionary}
            item={selectedItem}
            corrections={corrections}
            setCorrections={setCorrections}
            isAnalyzing={analyzingItemId === selectedItem.id}
            isSavingCorrections={isSavingCorrections}
            onAnalyze={() => void triggerAnalysis(selectedItem)}
            onSaveCorrections={() => void saveCorrections(selectedItem)}
          />
        </aside>
      )}

      {toastMessage && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-foreground/10 bg-foreground px-4 py-2 text-sm text-background shadow-xl"
          role="status"
        >
          {toastMessage}
        </div>
      )}

      {isSubmitting && !editingItem && (
        <ProcessingModal
          title={t.processing.title}
          subtitle={t.processing.subtitle}
          beforeLabel={t.processing.before}
          afterLabel={t.processing.after}
          previewUrl={imagePreview?.url ?? null}
          previewAlt={t.preview.alt}
          steps={processingSteps}
          currentStepIndex={processingStepIndex}
          estimatedRemaining={t.processing.estimatedRemaining.replace(
            '{seconds}',
            String(
              Math.max((processingSteps.length - processingStepIndex) * 2, 2),
            ),
          )}
        />
      )}
    </div>
  )
}

function ProcessingModal({
  title,
  subtitle,
  beforeLabel,
  afterLabel,
  previewUrl,
  previewAlt,
  steps,
  currentStepIndex,
  estimatedRemaining,
}: {
  title: string
  subtitle: string
  beforeLabel: string
  afterLabel: string
  previewUrl: string | null
  previewAlt: string
  steps: string[]
  currentStepIndex: number
  estimatedRemaining: string
}) {
  const progress = Math.round(((currentStepIndex + 1) / steps.length) * 100)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wardrobe-processing-title"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-2xl">
        <div className="grid gap-6 p-5 md:p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <PreviewPane
              label={beforeLabel}
              previewUrl={previewUrl}
              previewAlt={previewAlt}
            />
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-muted">
              <div
                className="grid size-16 place-items-center rounded-full bg-foreground text-xs font-medium text-background transition-all duration-700"
                style={{
                  background: `conic-gradient(var(--foreground) ${progress}%, var(--muted) 0)`,
                }}
              >
                <span className="grid size-12 place-items-center rounded-full bg-card text-foreground">
                  {progress}%
                </span>
              </div>
            </div>
            <PreviewPane
              label={afterLabel}
              previewUrl={previewUrl}
              previewAlt={previewAlt}
              processed
            />
          </div>

          <div className="text-center">
            <h2
              id="wardrobe-processing-title"
              className="font-serif text-xl font-medium"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{steps[currentStepIndex]}</span>
              <span className="text-muted-foreground">
                {estimatedRemaining}
              </span>
            </div>
            <div className="grid gap-2">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition',
                    index === currentStepIndex && 'bg-muted text-foreground',
                    index < currentStepIndex && 'text-foreground',
                    index > currentStepIndex && 'text-muted-foreground',
                  )}
                >
                  {index < currentStepIndex ? (
                    <Check className="size-4" />
                  ) : index === currentStepIndex ? (
                    <Clock3 className="size-4 animate-pulse" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewPane({
  label,
  previewUrl,
  previewAlt,
  processed,
}: {
  label: string
  previewUrl: string | null
  previewAlt: string
  processed?: boolean
}) {
  return (
    <div className="grid gap-2">
      <span className="text-center text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <div
        className={cn(
          'grid aspect-[4/5] place-items-center overflow-hidden rounded-xl border border-border bg-muted',
          processed &&
            'bg-[linear-gradient(45deg,_var(--muted)_25%,_transparent_25%),linear-gradient(-45deg,_var(--muted)_25%,_transparent_25%),linear-gradient(45deg,_transparent_75%,_var(--muted)_75%),linear-gradient(-45deg,_transparent_75%,_var(--muted)_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0]',
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={previewAlt}
            className="size-full object-contain p-3"
          />
        ) : (
          <div className="size-24 animate-pulse rounded bg-background" />
        )}
      </div>
    </div>
  )
}

function getDisplayStatus(item: WardrobeItemDto) {
  const ageMs = Date.now() - new Date(item.createdAt).getTime()
  const ageDays = ageMs / 86_400_000

  if (ageDays < 14) return 'new'
  if ((item.effectiveAnalysis?.confidenceScore ?? 0) > 0.85) {
    return 'oftenWorn'
  }
  if (ageDays > 90) return 'notWornLong'

  return 'inLaundry'
}

function OnboardingPanel({ dictionary }: { dictionary: Dictionary }) {
  const steps = [
    dictionary.onboarding.steps.add,
    dictionary.onboarding.steps.analyze,
    dictionary.onboarding.steps.generate,
  ]

  return (
    <div className="rounded-xl border border-foreground/10 bg-card p-5 shadow-sm">
      <p className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
        <Sparkles className="size-3.5" />
        {dictionary.onboarding.eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-2xl font-medium">
        {dictionary.onboarding.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {dictionary.onboarding.body}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step}
            className="rounded-lg border border-border bg-muted/30 p-3"
          >
            <span className="grid size-7 place-items-center rounded-full bg-foreground text-xs font-medium text-background">
              {index + 1}
            </span>
            <p className="mt-3 text-sm font-medium">{step}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConfidenceMeter({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100)

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function AnalysisStatusBadge({
  label,
  status,
}: {
  label: string
  status: WardrobeItemDto['analysisStatus']
}) {
  const className =
    status === 'done'
      ? 'bg-green-100 text-green-800'
      : status === 'failed'
        ? 'bg-destructive/10 text-destructive'
        : status === 'analyzing'
          ? 'bg-accent/20 text-foreground'
          : 'bg-secondary text-secondary-foreground'

  return (
    <span
      className={`inline-flex w-fit rounded-md px-2 py-1 text-xs ${className}`}
    >
      {label}
    </span>
  )
}

function AnalysisPanel({
  dictionary,
  item,
  corrections,
  setCorrections,
  isAnalyzing,
  isSavingCorrections,
  onAnalyze,
  onSaveCorrections,
}: {
  dictionary: Dictionary
  item: WardrobeItemDto
  corrections: AnalysisCorrectionState
  setCorrections: React.Dispatch<React.SetStateAction<AnalysisCorrectionState>>
  isAnalyzing: boolean
  isSavingCorrections: boolean
  onAnalyze: () => void
  onSaveCorrections: () => void
}) {
  const t = dictionary.wardrobe.analysis
  const analysis = item.effectiveAnalysis

  return (
    <div className="mt-5 rounded-xl border border-foreground/10 bg-background/60 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-lg font-medium">
            <Brain className="size-4" />
            {t.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.status[item.analysisStatus]}
          </p>
        </div>
        {item.analysisStatus === 'done' ? (
          <CheckCircle2 className="size-5 text-green-700" />
        ) : item.analysisStatus === 'failed' ? (
          <AlertCircle className="size-5 text-destructive" />
        ) : item.analysisStatus === 'analyzing' || isAnalyzing ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {item.analysisStatus === 'pending' && (
        <Button type="button" className="mt-4" onClick={onAnalyze}>
          <Brain />
          {t.actions.analyze}
        </Button>
      )}

      {(item.analysisStatus === 'analyzing' || isAnalyzing) && (
        <div className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-3">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t.messages.analyzing}
          </p>
          <AnalysisTimeline
            labels={[
              t.timeline.detect,
              t.timeline.attributes,
              t.timeline.confidence,
            ]}
          />
        </div>
      )}

      {item.analysisStatus === 'failed' && (
        <div className="mt-4 grid gap-3">
          <p className="text-sm text-destructive">
            {item.analysisError
              ? getAnalysisErrorMessage(dictionary, item.analysisError)
              : t.messages.failed}
          </p>
          <Button type="button" variant="outline" onClick={onAnalyze}>
            <RefreshCw />
            {t.actions.retry}
          </Button>
        </div>
      )}

      {item.analysisStatus === 'done' && analysis && (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 rounded-lg bg-muted/30 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background">
                <Sparkles className="size-3.5" />
                {t.aiDetected}
              </p>
              <div className="min-w-36">
                <ConfidenceMeter
                  label={t.fields.confidenceScore}
                  value={analysis.confidenceScore}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <AnalysisTag
                label={t.fields.detectedCategory}
                value={analysis.detectedCategory}
              />
              <AnalysisTag
                label={t.fields.style}
                value={listToText(analysis.style)}
              />
              <AnalysisTag
                label={t.fields.season}
                value={listToText(analysis.season)}
              />
              <AnalysisTag
                label={t.fields.material}
                value={analysis.material}
              />
              <AnalysisTag
                label={t.fields.colors}
                value={listToText(analysis.colors)}
              />
              <AnalysisTag
                label={t.fields.formalityLevel}
                value={String(analysis.formalityLevel)}
              />
              <AnalysisTag
                label={t.fields.warmthLevel}
                value={String(analysis.warmthLevel)}
              />
            </div>
          </div>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <Detail
              label={t.fields.detectedClothingType}
              value={analysis.detectedClothingType}
            />
            <Detail
              label={t.fields.detectedCategory}
              value={analysis.detectedCategory}
            />
            <Detail
              label={t.fields.colors}
              value={listToText(analysis.colors)}
            />
            <Detail
              label={t.fields.season}
              value={listToText(analysis.season)}
            />
            <Detail label={t.fields.style} value={listToText(analysis.style)} />
            <Detail label={t.fields.material} value={analysis.material} />
            <Detail label={t.fields.fit} value={analysis.fit} />
            <Detail label={t.fields.pattern} value={analysis.pattern} />
            <Detail label={t.fields.brandGuess} value={analysis.brandGuess} />
            <Detail
              label={t.fields.warmthLevel}
              value={String(analysis.warmthLevel)}
            />
            <Detail
              label={t.fields.formalityLevel}
              value={String(analysis.formalityLevel)}
            />
            <Detail
              label={t.fields.confidenceScore}
              value={`${Math.round(analysis.confidenceScore * 100)}%`}
            />
            <Detail
              label={t.fields.needsReview}
              value={
                analysis.needsReviewFields.length > 0
                  ? listToText(analysis.needsReviewFields)
                  : '—'
              }
            />
            <Detail
              label={t.fields.dominantHexColors}
              value={listToText(analysis.dominantHexColors)}
            />
            <Detail
              label={t.fields.visualDescription}
              value={analysis.visualDescription}
              wide
            />
            <Detail
              label={t.fields.promptVersion}
              value={analysis.promptVersion}
            />
            <Detail label={t.fields.modelId} value={analysis.modelId} />
          </dl>

          <div className="grid gap-3 border-t border-border pt-4">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {t.userCorrected}
              </p>
              <h4 className="mt-1 font-medium">{t.reviewTitle}</h4>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <CorrectionField
                label={t.fields.detectedClothingType}
                value={corrections.detectedClothingType}
                onChange={(value) =>
                  setCorrections((current) => ({
                    ...current,
                    detectedClothingType: value,
                  }))
                }
              />
              <div className="grid gap-2">
                <Label>{t.fields.detectedCategory}</Label>
                <select
                  value={corrections.detectedCategory}
                  onChange={(event) =>
                    setCorrections((current) => ({
                      ...current,
                      detectedCategory: event.target.value,
                    }))
                  }
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {wardrobeCategories.map((category) => (
                    <option key={category} value={category}>
                      {dictionary.wardrobe.options.categories[category]}
                    </option>
                  ))}
                </select>
              </div>
              <CorrectionField
                label={t.fields.colors}
                value={corrections.colors}
                onChange={(value) =>
                  setCorrections((current) => ({ ...current, colors: value }))
                }
              />
              <CorrectionField
                label={t.fields.season}
                value={corrections.season}
                onChange={(value) =>
                  setCorrections((current) => ({ ...current, season: value }))
                }
              />
              <CorrectionField
                label={t.fields.style}
                value={corrections.style}
                onChange={(value) =>
                  setCorrections((current) => ({ ...current, style: value }))
                }
              />
              <CorrectionField
                label={t.fields.material}
                value={corrections.material}
                onChange={(value) =>
                  setCorrections((current) => ({ ...current, material: value }))
                }
              />
              <CorrectionField
                label={t.fields.fit}
                value={corrections.fit}
                onChange={(value) =>
                  setCorrections((current) => ({ ...current, fit: value }))
                }
              />
              <CorrectionField
                label={t.fields.pattern}
                value={corrections.pattern}
                onChange={(value) =>
                  setCorrections((current) => ({ ...current, pattern: value }))
                }
              />
              <CorrectionField
                label={t.fields.brandGuess}
                value={corrections.brandGuess}
                onChange={(value) =>
                  setCorrections((current) => ({
                    ...current,
                    brandGuess: value,
                  }))
                }
              />
              <CorrectionField
                label={t.fields.dominantHexColors}
                value={corrections.dominantHexColors}
                onChange={(value) =>
                  setCorrections((current) => ({
                    ...current,
                    dominantHexColors: value,
                  }))
                }
              />
              <CorrectionField
                label={t.fields.warmthLevel}
                value={corrections.warmthLevel}
                type="number"
                min={1}
                max={5}
                onChange={(value) =>
                  setCorrections((current) => ({
                    ...current,
                    warmthLevel: value,
                  }))
                }
              />
              <CorrectionField
                label={t.fields.formalityLevel}
                value={corrections.formalityLevel}
                type="number"
                min={1}
                max={5}
                onChange={(value) =>
                  setCorrections((current) => ({
                    ...current,
                    formalityLevel: value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>{t.fields.visualDescription}</Label>
              <textarea
                value={corrections.visualDescription}
                onChange={(event) =>
                  setCorrections((current) => ({
                    ...current,
                    visualDescription: event.target.value,
                  }))
                }
                className="min-h-20 rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              />
            </div>
            <Button
              type="button"
              className="w-fit"
              disabled={isSavingCorrections}
              onClick={onSaveCorrections}
            >
              <CheckCircle2 />
              {isSavingCorrections
                ? dictionary.common.loading
                : t.actions.saveCorrections}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function CorrectionField({
  label,
  value,
  type = 'text',
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  type?: 'text' | 'number'
  min?: number
  max?: number
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function AnalysisTimeline({ labels }: { labels: string[] }) {
  return (
    <div className="grid gap-2">
      {labels.map((label, index) => (
        <div key={label} className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              'grid size-5 place-items-center rounded-full text-[10px] font-medium',
              index === 0
                ? 'bg-foreground text-background'
                : 'bg-background text-muted-foreground',
            )}
          >
            {index + 1}
          </span>
          <span className="text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}

function AnalysisTag({ label, value }: { label: string; value: string }) {
  if (!value) return null

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-background px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  )
}

function Field({
  id,
  label,
  value,
  placeholder,
  required,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  required?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function CheckboxGroup<T extends string>({
  label,
  values,
  selected,
  labels,
  onToggle,
}: {
  label: string
  values: readonly T[]
  selected: string[]
  labels: Record<T, string>
  onToggle: (value: T) => void
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
            />
            {labels[value]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function TagList({ values }: { values: string[] }) {
  const tags = values.filter(Boolean).slice(0, 6)
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((value) => (
        <span
          key={value}
          className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
        >
          {value}
        </span>
      ))}
    </div>
  )
}

function WearSummary({
  dictionary,
  item,
}: {
  dictionary: Dictionary
  item: WardrobeItemDto
}) {
  const t = dictionary.wear.card
  const lastWornLabel = item.lastWornAt
    ? t.lastWorn.replace('{date}', formatLocalDate(item.lastWornAt))
    : t.neverWorn

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="rounded-md bg-muted px-2 py-1">
        {item.neverWorn
          ? t.neverWorn
          : t.wearCount.replace('{count}', String(item.wearCount))}
      </span>
      {!item.neverWorn && (
        <span className="rounded-md bg-muted px-2 py-1">{lastWornLabel}</span>
      )}
      {item.longUnusedStatus && (
        <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">
          {t.longUnused.replace('{days}', item.longUnusedStatus)}
        </span>
      )}
    </div>
  )
}

function InsightsPanel({
  dictionary,
  insights,
  range,
  dismissedItemIds,
  onRangeChange,
  onDismissItem,
}: {
  dictionary: Dictionary
  insights: WardrobeInsightsDto | null
  range: WardrobeInsightsDto['range']
  dismissedItemIds: Set<string>
  onRangeChange: (range: WardrobeInsightsDto['range']) => void
  onDismissItem: (itemId: string) => void
}) {
  const t = dictionary.wear.insights
  const visibleLongUnused =
    insights?.longUnused['30'].filter(
      (item) => !dismissedItemIds.has(item.id),
    ) ?? []

  return (
    <section className="rounded-xl border border-foreground/10 bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-serif text-xl font-medium">{t.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            {t.range}
          </span>
          <select
            value={range}
            onChange={(event) =>
              onRangeChange(event.target.value as WardrobeInsightsDto['range'])
            }
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            {(['30', '60', '90', 'all'] as const).map((value) => (
              <option key={value} value={value}>
                {t.ranges[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!insights ? (
        <div className="mt-4 h-32 animate-pulse rounded-lg bg-muted" />
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <InsightMetric
              label={t.utilization}
              value={`${insights.utilizationPercentage}%`}
            />
            <InsightMetric
              label={t.usedVsUnused
                .replace('{used}', String(insights.uniqueItemsWorn))
                .replace(
                  '{unused}',
                  String(insights.totalActiveItems - insights.uniqueItemsWorn),
                )}
              value={`${insights.uniqueItemsWorn}/${insights.totalActiveItems}`}
            />
            <InsightMetric
              label={t.totalWears}
              value={String(insights.totalRecordedWears)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InsightList
              title={t.mostWorn}
              empty={t.empty}
              items={insights.mostWornItems}
            />
            <InsightList
              title={t.neverWorn}
              empty={t.empty}
              items={insights.neverWornItems}
            />
          </div>

          {visibleLongUnused.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <h3 className="font-medium">{t.longUnused}</h3>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {visibleLongUnused.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="min-w-44 rounded-lg border border-border bg-background p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-28 w-full object-contain"
                    />
                    <p className="mt-2 truncate text-sm font-medium">
                      {item.name}
                    </p>
                    <div className="mt-2 flex gap-1">
                      <a
                        href="/dashboard/stylist"
                        className="rounded-md bg-foreground px-2 py-1 text-xs text-background"
                      >
                        {dictionary.wear.actions.createOutfit}
                      </a>
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs"
                        onClick={() => onDismissItem(item.id)}
                      >
                        {dictionary.wear.actions.undo}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <h3 className="font-medium">{t.recentActivity}</h3>
              <div className="mt-3 grid gap-2 text-sm">
                {insights.recentActivity.length === 0 ? (
                  <p className="text-muted-foreground">{t.empty}</p>
                ) : (
                  insights.recentActivity.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate">
                        {log.items.map((item) => item.name).join(', ')}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatLocalDate(log.wornAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <h3 className="font-medium">{t.categoryUsage}</h3>
              <div className="mt-3 grid gap-2 text-sm">
                {insights.categoryUsage.map((category) => (
                  <div key={category.category}>
                    <div className="flex justify-between gap-3">
                      <span>
                        {dictionary.wardrobe.options.categories[
                          category.category as keyof typeof dictionary.wardrobe.options.categories
                        ] ?? category.category}
                      </span>
                      <span>{category.utilizationPercentage}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${category.utilizationPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl font-medium">{value}</p>
    </div>
  )
}

function InsightList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: WardrobeInsightsDto['mostWornItems']
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="font-medium">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.name}
                className="size-10 rounded-md object-contain"
              />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="text-muted-foreground">
                {item.totalWearCount}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-foreground">{value || '-'}</dd>
    </div>
  )
}
