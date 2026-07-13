'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Briefcase,
  CalendarHeart,
  CloudRain,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Star,
  Sun,
  Umbrella,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'
import type { OutfitDto, QuickRequestId } from '@/lib/stylist'
import type { WearLogDto } from '@/lib/wear'
import { cn } from '@/lib/utils'

type InsufficientWardrobeResult = {
  status: 'insufficient_wardrobe'
  message: string
  missingCategories: string[]
  availableCategories: string[]
}

type PreferenceState = {
  preferredStyles: string
  dislikedStyles: string
  preferredColors: string
  avoidedColors: string
  preferredFormality: string
  preferredFit: string
}

const emptyPreferences: PreferenceState = {
  preferredStyles: '',
  dislikedStyles: '',
  preferredColors: '',
  avoidedColors: '',
  preferredFormality: '',
  preferredFit: '',
}

const quickIcons = {
  university: MessageCircle,
  work: Briefcase,
  date: Heart,
  restaurant: Sparkles,
  wedding: CalendarHeart,
  vacation: Sun,
  cold_weather: Umbrella,
  hot_weather: Sun,
  rain: CloudRain,
  old_money: Sparkles,
  luxury: Star,
  streetwear: Sparkles,
  sport: Sparkles,
  business: Briefcase,
  complete_outfit: Sparkles,
}

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function makeWearIdempotencyKey(scope: string) {
  return `${scope}:${Date.now()}:${crypto.randomUUID()}`
}

export function StylistPageClient({
  dictionary,
  locale,
}: {
  dictionary: Dictionary
  locale: Locale
}) {
  const t = dictionary.stylist
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<OutfitDto[]>([])
  const [savedOutfits, setSavedOutfits] = useState<OutfitDto[]>([])
  const [candidates, setCandidates] = useState<OutfitDto[]>([])
  const [insufficientWardrobe, setInsufficientWardrobe] =
    useState<InsufficientWardrobeResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRecordingWear, setIsRecordingWear] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [preferences, setPreferences] =
    useState<PreferenceState>(emptyPreferences)
  const [lockedItemIds, setLockedItemIds] = useState<string[]>([])
  const [lastRequest, setLastRequest] = useState<{
    message: string
    quickRequest?: QuickRequestId
  } | null>(null)
  const generationInFlightRef = useRef(false)

  const quickRequests = useMemo(
    () =>
      Object.entries(t.quickRequests).map(([id, label]) => ({
        id: id as QuickRequestId,
        label,
        Icon: quickIcons[id as QuickRequestId] ?? Sparkles,
      })),
    [t.quickRequests],
  )

  const fetchOutfits = async () => {
    const [historyResponse, savedResponse] = await Promise.all([
      fetch('/api/stylist/outfits'),
      fetch('/api/stylist/outfits?saved=true'),
    ])
    if (historyResponse.ok) {
      const data = (await historyResponse.json()) as { outfits: OutfitDto[] }
      setHistory(data.outfits)
    }
    if (savedResponse.ok) {
      const data = (await savedResponse.json()) as { outfits: OutfitDto[] }
      setSavedOutfits(data.outfits)
    }
  }

  async function fetchPreferences() {
    const response = await fetch('/api/stylist/preferences')
    if (!response.ok) return
    const data = (await response.json()) as {
      preferences: {
        preferredStyles: string[]
        dislikedStyles: string[]
        preferredColors: string[]
        avoidedColors: string[]
        preferredFormality: string
        preferredFit: string
      }
    }
    setPreferences({
      preferredStyles: data.preferences.preferredStyles.join(', '),
      dislikedStyles: data.preferences.dislikedStyles.join(', '),
      preferredColors: data.preferences.preferredColors.join(', '),
      avoidedColors: data.preferences.avoidedColors.join(', '),
      preferredFormality: data.preferences.preferredFormality,
      preferredFit: data.preferences.preferredFit,
    })
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchOutfits()
      void fetchPreferences()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  const savePreferences = async () => {
    const toList = (value: string) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    const response = await fetch('/api/stylist/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferredStyles: toList(preferences.preferredStyles),
        dislikedStyles: toList(preferences.dislikedStyles),
        preferredColors: toList(preferences.preferredColors),
        avoidedColors: toList(preferences.avoidedColors),
        preferredFormality: preferences.preferredFormality,
        preferredFit: preferences.preferredFit,
      }),
    })
    if (!response.ok) {
      setError(t.errors.feedback)
      return
    }
    setToastMessage(t.preferences.saved)
  }

  useEffect(() => {
    if (!toastMessage) return
    const timeout = window.setTimeout(() => setToastMessage(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  const requestOutfit = async (input: {
    message: string
    quickRequest?: QuickRequestId
  }) => {
    if (generationInFlightRef.current) return

    generationInFlightRef.current = true
    setError(null)
    setInsufficientWardrobe(null)
    setIsLoading(true)
    setLastRequest(input)

    try {
      const response = await fetch('/api/stylist/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, locale, lockedItemIds }),
      })
      const data = (await response.json()) as {
        result?:
          | {
              status: 'success'
              outfit?: OutfitDto
              candidates?: OutfitDto[]
              limitedVariety?: boolean
              message?: string
            }
          | InsufficientWardrobeResult
        outfit?: OutfitDto
        candidates?: OutfitDto[]
        error?: string
        code?: string
        status?: string
      }
      if (!response.ok) {
        throw new Error(data.code ?? data.error ?? 'failed')
      }
      if (data.result?.status === 'insufficient_wardrobe') {
        setInsufficientWardrobe(data.result)
        setCandidates([])
        setMessage('')
        return
      }

      const nextCandidates =
        data.result?.status === 'success'
          ? (data.result.candidates ??
            (data.result.outfit ? [data.result.outfit] : []))
          : (data.candidates ?? (data.outfit ? [data.outfit] : []))
      const outfit = nextCandidates[0]
      if (!outfit || nextCandidates.length === 0) {
        throw new Error('empty_outfit')
      }

      setCandidates(nextCandidates)
      setHistory((current) => [...nextCandidates, ...current])
      setMessage('')
    } catch (generateError) {
      const errorCode =
        generateError instanceof Error ? generateError.message : ''
      setError(
        errorCode === 'stylist_provider_timeout'
          ? t.errors.timeout
          : errorCode === 'stylist_generation_in_progress'
            ? t.errors.inProgress
            : errorCode === 'invalid_stylist_batch_result'
              ? t.errors.providerFormat
              : t.errors.generate,
      )
    } finally {
      generationInFlightRef.current = false
      setIsLoading(false)
    }
  }

  const updateOutfit = async (
    outfit: OutfitDto,
    patch: Partial<Pick<OutfitDto, 'isSaved' | 'isFavorite'>>,
  ) => {
    const response = await fetch(`/api/stylist/outfits/${outfit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      setError(t.errors.save)
      return
    }

    const updated = { ...outfit, ...patch }
    setCandidates((current) =>
      current.map((entry) => (entry.id === outfit.id ? updated : entry)),
    )
    setHistory((current) =>
      current.map((entry) => (entry.id === outfit.id ? updated : entry)),
    )
    void fetchOutfits()
  }

  const replaceOutfitItem = async (
    outfit: OutfitDto,
    wardrobeItemId: string,
  ) => {
    const response = await fetch('/api/stylist/replace-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outfitId: outfit.id, wardrobeItemId }),
    })
    if (!response.ok) {
      setError(t.errors.generate)
      return
    }
    const data = (await response.json()) as { outfit: OutfitDto }
    setCandidates((current) =>
      current.map((entry) => (entry.id === outfit.id ? data.outfit : entry)),
    )
  }

  const submitFeedback = async (outfit: OutfitDto, rating: string) => {
    const response = await fetch('/api/stylist/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outfitId: outfit.id,
        rating,
        reasonTags: [rating],
      }),
    })
    if (!response.ok) setError(t.errors.feedback)
  }

  const rateOutfit = async (outfit: OutfitDto, rating: string) => {
    const response = await fetch(`/api/stylist/outfits/${outfit.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    })
    if (!response.ok) setError(t.errors.feedback)
  }

  const recordOutfitWear = async (outfit: OutfitDto) => {
    if (isRecordingWear) return
    setIsRecordingWear(true)
    setError(null)

    try {
      const response = await fetch('/api/wear-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outfitId: outfit.id,
          wornAt: new Date().toISOString(),
          timezone: getBrowserTimezone(),
          idempotencyKey: makeWearIdempotencyKey(outfit.id),
        }),
      })
      const data = (await response.json()) as {
        wearLog?: WearLogDto
        message?: string
      }
      if (!response.ok || !data.wearLog) throw new Error('wear_failed')
      setToastMessage(data.message ?? dictionary.wear.toast.recorded)
    } catch {
      setError(dictionary.wear.errors.wear_log_write_failed)
    } finally {
      setIsRecordingWear(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <section className="grid gap-5">
        <div className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            <Sparkles className="size-3.5" />
            {t.eyebrow}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">
            {t.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickRequests.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              disabled={isLoading}
              onClick={() =>
                void requestOutfit({ message: label, quickRequest: id })
              }
              className="group flex items-center gap-3 rounded-xl border border-foreground/10 bg-card p-3 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md"
            >
              <span className="grid size-8 place-items-center rounded-full bg-muted transition group-hover:bg-foreground group-hover:text-background">
                <Icon className="size-4" />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MessageCircle className="size-4" />
            {t.chatTitle}
          </div>
          <div className="grid min-h-48 content-start gap-3 rounded-xl bg-muted/40 p-3">
            {history.slice(0, 4).map((outfit) => (
              <button
                key={outfit.id}
                type="button"
                onClick={() => setCandidates([outfit])}
                className="max-w-[85%] rounded-2xl rounded-tl-sm bg-background p-3 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="font-medium">{outfit.title}</span>
                <span className="mt-1 block text-muted-foreground">
                  {outfit.overallExplanation}
                </span>
              </button>
            ))}
            {isLoading && (
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-background p-3 text-sm shadow-sm">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {t.states.thinking}
                </span>
                <div className="mt-3 flex gap-1">
                  <span className="size-2 animate-bounce rounded-full bg-foreground" />
                  <span className="size-2 animate-bounce rounded-full bg-foreground [animation-delay:120ms]" />
                  <span className="size-2 animate-bounce rounded-full bg-foreground [animation-delay:240ms]" />
                </div>
              </div>
            )}
          </div>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              void requestOutfit({ message })
            }}
          >
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t.inputPlaceholder}
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !message.trim()}>
              <Send />
              {t.actions.send}
            </Button>
          </form>
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        {insufficientWardrobe ? (
          <InsufficientWardrobePanel
            dictionary={dictionary}
            result={insufficientWardrobe}
            onTrySimpler={() =>
              void requestOutfit({
                message: t.insufficient.trySimplerPrompt,
              })
            }
          />
        ) : candidates.length > 0 ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-medium">
                {t.result.outfitOptions}
              </h2>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() =>
                  lastRequest ? void requestOutfit(lastRequest) : undefined
                }
              >
                <RefreshCw />
                {t.actions.regenerateAll}
              </Button>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {candidates.map((candidate) => (
                <OutfitResult
                  key={candidate.id}
                  dictionary={dictionary}
                  outfit={candidate}
                  isLoading={isLoading}
                  onSave={() =>
                    void updateOutfit(candidate, {
                      isSaved: !candidate.isSaved,
                    })
                  }
                  onFavorite={() =>
                    void updateOutfit(candidate, {
                      isFavorite: !candidate.isFavorite,
                    })
                  }
                  onRegenerate={() =>
                    lastRequest ? void requestOutfit(lastRequest) : undefined
                  }
                  isRecordingWear={isRecordingWear}
                  onRecordWear={() => void recordOutfitWear(candidate)}
                  onReplaceItem={(wardrobeItemId) =>
                    void replaceOutfitItem(candidate, wardrobeItemId)
                  }
                  lockedItemIds={lockedItemIds}
                  onToggleKeep={(wardrobeItemId) =>
                    setLockedItemIds((current) =>
                      current.includes(wardrobeItemId)
                        ? current.filter((id) => id !== wardrobeItemId)
                        : [...current, wardrobeItemId],
                    )
                  }
                  onFeedback={(rating) =>
                    void submitFeedback(candidate, rating)
                  }
                  onRate={(rating) => void rateOutfit(candidate, rating)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-border p-6 text-center">
            <div>
              <Sparkles className="mx-auto mb-3 size-8 text-muted-foreground" />
              <h2 className="font-serif text-xl font-medium">
                {t.empty.title}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {t.empty.body}
              </p>
            </div>
          </div>
        )}
      </section>

      <aside className="grid content-start gap-4">
        <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
          <h2 className="font-serif text-lg font-medium">{t.saved.title}</h2>
          <div className="mt-3 grid gap-3">
            {savedOutfits.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.saved.empty}</p>
            ) : (
              savedOutfits.map((outfit) => (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() => setCandidates([outfit])}
                  className="rounded-xl border border-border p-3 text-left text-sm transition hover:bg-muted/50"
                >
                  <span className="font-medium">{outfit.title}</span>
                  <span className="mt-1 block text-muted-foreground">
                    {Math.round(outfit.confidenceScore * 100)}%
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
          <h2 className="font-serif text-lg font-medium">{t.history.title}</h2>
          <div className="mt-3 grid gap-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.history.empty}</p>
            ) : (
              history.map((outfit) => (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() => setCandidates([outfit])}
                  className="rounded-md px-2 py-1 text-left text-sm transition hover:bg-muted"
                >
                  {outfit.title}
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
          <h2 className="font-serif text-lg font-medium">
            {t.preferences.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.preferences.body}
          </p>
          <div className="mt-3 grid gap-2">
            {(
              [
                'preferredStyles',
                'dislikedStyles',
                'preferredColors',
                'avoidedColors',
                'preferredFormality',
                'preferredFit',
              ] as const
            ).map((key) => (
              <Input
                key={key}
                value={preferences[key]}
                placeholder={t.preferences.fields[key]}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            ))}
            <Button type="button" variant="outline" onClick={savePreferences}>
              <Save />
              {t.preferences.save}
            </Button>
          </div>
        </section>
      </aside>
      {toastMessage && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-foreground/10 bg-foreground px-4 py-2 text-sm text-background shadow-xl"
          role="status"
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}

function formatCategory(dictionary: Dictionary, category: string) {
  const labels = dictionary.wardrobe.options.categories
  return labels[category as keyof typeof labels] ?? category
}

function InsufficientWardrobePanel({
  dictionary,
  result,
  onTrySimpler,
}: {
  dictionary: Dictionary
  result: InsufficientWardrobeResult
  onTrySimpler: () => void
}) {
  const t = dictionary.stylist.insufficient

  return (
    <Card className="rounded-2xl border-foreground/10 shadow-sm">
      <CardContent className="grid gap-5">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            <Sparkles className="size-3.5" />
            {t.badge}
          </p>
          <h2 className="font-serif text-2xl font-medium">{t.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {result.message}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="font-medium">{t.missing}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.missingCategories.map((category) => (
                <span
                  key={category}
                  className="rounded-md bg-background px-2 py-1 text-xs"
                >
                  {formatCategory(dictionary, category)}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="font-medium">{t.available}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.availableCategories.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  {t.noneAvailable}
                </span>
              ) : (
                result.availableCategories.map((category) => (
                  <span
                    key={category}
                    className="rounded-md bg-background px-2 py-1 text-xs"
                  >
                    {formatCategory(dictionary, category)}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{t.body}</p>

        <div className="flex flex-wrap gap-2">
          <a
            href="/dashboard/wardrobe"
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            {t.openWardrobe}
          </a>
          <a
            href="/dashboard/wardrobe"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            {t.correctCategories}
          </a>
          <Button type="button" variant="outline" onClick={onTrySimpler}>
            <RefreshCw />
            {t.trySimpler}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function OutfitResult({
  dictionary,
  outfit,
  isLoading,
  onSave,
  onFavorite,
  onRegenerate,
  isRecordingWear,
  onRecordWear,
  onReplaceItem,
  lockedItemIds,
  onToggleKeep,
  onFeedback,
  onRate,
}: {
  dictionary: Dictionary
  outfit: OutfitDto
  isLoading: boolean
  onSave: () => void
  onFavorite: () => void
  onRegenerate: () => void
  isRecordingWear: boolean
  onRecordWear: () => void
  onReplaceItem: (wardrobeItemId: string) => void
  lockedItemIds: string[]
  onToggleKeep: (wardrobeItemId: string) => void
  onFeedback: (rating: string) => void
  onRate: (rating: string) => void
}) {
  const t = dictionary.stylist

  return (
    <Card className="rounded-2xl border-foreground/10 shadow-sm">
      <CardContent className="grid gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              <Sparkles className="size-3.5" />
              {t.result.outfitLabel}
            </p>
            <h2 className="font-serif text-2xl font-medium">{outfit.title}</h2>
            {outfit.styleDirection && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t.result.styleDirection}: {outfit.styleDirection}
              </p>
            )}
            <div className="mt-3 max-w-xs">
              <StylistConfidence
                label={t.result.confidenceLabel}
                value={outfit.confidenceScore}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onSave}>
              <Save />
              {outfit.isSaved ? t.actions.saved : t.actions.save}
            </Button>
            <Button type="button" variant="outline" onClick={onFavorite}>
              <Heart
                className={outfit.isFavorite ? 'fill-current' : undefined}
              />
              {outfit.isFavorite ? t.actions.favorited : t.actions.favorite}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={onRegenerate}
            >
              <RefreshCw />
              {t.actions.regenerate}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isRecordingWear}
              onClick={onRecordWear}
            >
              {isRecordingWear
                ? dictionary.common.loading
                : dictionary.wear.actions.woreThisOutfit}
            </Button>
          </div>
        </div>

        {outfit.missingItems.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <h3 className="font-medium">{t.insufficient.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.insufficient.body}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {outfit.missingItems.map((item) => (
                <span
                  key={item}
                  className="rounded-md bg-background px-2 py-1 text-xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <h3 className="font-medium">{t.result.explanation}</h3>
          <p className="mt-2 text-sm leading-relaxed">
            {outfit.overallExplanation}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {outfit.items.map(({ item, explanation, role }) => (
            <div
              key={`${outfit.id}-${role}-${item?.id}`}
              className="overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-[4/5] bg-[linear-gradient(135deg,_var(--muted),_var(--background))]">
                {item && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="size-full object-contain p-4"
                  />
                )}
              </div>
              <div className="grid gap-2 p-3 text-sm">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {role}
                </p>
                <h3 className="font-medium">{item?.name ?? role}</h3>
                <p className="text-muted-foreground">{explanation}</p>
                {item && (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="/dashboard/wardrobe"
                      className="rounded-md border border-border px-2 py-1 text-xs"
                    >
                      {t.actions.openItem}
                    </a>
                    <button
                      type="button"
                      className={cn(
                        'rounded-md border border-border px-2 py-1 text-xs',
                        lockedItemIds.includes(item.id) &&
                          'bg-accent/10 text-accent',
                      )}
                      onClick={() => onToggleKeep(item.id)}
                    >
                      {t.actions.keepItem}
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-foreground px-2 py-1 text-xs text-background"
                      onClick={() => onReplaceItem(item.id)}
                    >
                      {t.actions.replaceItem}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {outfit.alternativeSuggestions.length > 0 && (
          <div className="grid gap-2">
            <h3 className="font-medium">{t.result.alternatives}</h3>
            <div className="flex snap-x gap-3 overflow-x-auto pb-1">
              {outfit.alternativeSuggestions.map((alternative) => (
                <div
                  key={alternative.title}
                  className="min-w-64 snap-start rounded-xl border border-border bg-muted/30 p-3"
                >
                  <p className="font-medium">{alternative.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {alternative.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
            {t.feedback.title}
          </span>
          {['like', 'dislike', 'not_my_style', 'too_formal', 'too_casual'].map(
            (rating) => (
              <Button
                key={rating}
                type="button"
                variant="outline"
                onClick={() => onFeedback(rating)}
              >
                {t.feedback.reasons[
                  rating as keyof typeof t.feedback.reasons
                ] ?? rating}
              </Button>
            ),
          )}
          {['1', '2', '3', '4', '5'].map((rating) => (
            <Button
              key={rating}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t.feedback.rate.replace('{rating}', rating)}
              onClick={() => onRate(rating)}
            >
              <Star />
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StylistConfidence({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100)

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
