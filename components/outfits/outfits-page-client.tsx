'use client'

import { useEffect, useState } from 'react'
import { Heart, Sparkles, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { OutfitDto } from '@/lib/stylist'
import type { WearLogDto } from '@/lib/wear'

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function makeWearIdempotencyKey(scope: string) {
  return `${scope}:${Date.now()}:${crypto.randomUUID()}`
}

export function OutfitsPageClient({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.outfits
  const [outfits, setOutfits] = useState<OutfitDto[]>([])
  const [savedOutfits, setSavedOutfits] = useState<OutfitDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [wearingOutfitIds, setWearingOutfitIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOutfits = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [historyResponse, savedResponse] = await Promise.all([
          fetch('/api/stylist/outfits'),
          fetch('/api/stylist/outfits?saved=true'),
        ])

        if (!historyResponse.ok || !savedResponse.ok) {
          throw new Error('load_failed')
        }

        const historyData = (await historyResponse.json()) as {
          outfits: OutfitDto[]
        }
        const savedData = (await savedResponse.json()) as {
          outfits: OutfitDto[]
        }

        setOutfits(historyData.outfits)
        setSavedOutfits(savedData.outfits)
      } catch {
        setError(t.error)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchOutfits()
  }, [t.error])

  useEffect(() => {
    if (!toastMessage) return
    const timeout = window.setTimeout(() => setToastMessage(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  const recordOutfitWear = async (outfit: OutfitDto) => {
    if (wearingOutfitIds.has(outfit.id)) return
    setWearingOutfitIds((current) => new Set(current).add(outfit.id))
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
      setWearingOutfitIds((current) => {
        const next = new Set(current)
        next.delete(outfit.id)
        return next
      })
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-2xl bg-muted"
            aria-label={t.loading}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (outfits.length === 0) {
    return (
      <div className="grid min-h-96 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
        <div>
          <Sparkles className="mx-auto mb-3 size-9 text-muted-foreground" />
          <h1 className="font-serif text-2xl font-medium">{t.emptyTitle}</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {t.emptyBody}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
          <Sparkles className="size-3.5" />
          {t.eyebrow}
        </p>
        <h1 className="mt-3 font-serif text-3xl font-medium">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t.subtitle}
        </p>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-medium">{t.savedTitle}</h2>
          <span className="text-sm text-muted-foreground">
            {t.count.replace('{count}', String(savedOutfits.length))}
          </span>
        </div>
        {savedOutfits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            {t.savedEmpty}
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
            {savedOutfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                dictionary={dictionary}
                outfit={outfit}
                isRecordingWear={wearingOutfitIds.has(outfit.id)}
                onRecordWear={() => void recordOutfitWear(outfit)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="font-serif text-xl font-medium">{t.historyTitle}</h2>
        <div className="grid gap-3">
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(outfit.createdAt).toLocaleDateString()}
                  </p>
                  <h3 className="font-medium">{outfit.title}</h3>
                </div>
                <RatingPreview dictionary={dictionary} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {outfit.overallExplanation}
              </p>
            </div>
          ))}
        </div>
      </section>
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

function OutfitCard({
  dictionary,
  outfit,
  isRecordingWear,
  onRecordWear,
}: {
  dictionary: Dictionary
  outfit: OutfitDto
  isRecordingWear: boolean
  onRecordWear: () => void
}) {
  const t = dictionary.outfits

  return (
    <article className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="grid grid-cols-2 gap-1 bg-muted p-1">
        {outfit.items.slice(0, 4).map(({ item, role }) => (
          <div
            key={`${outfit.id}-${role}`}
            className="aspect-[4/5] bg-background"
          >
            {item && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.name}
                className="size-full object-contain p-2"
              />
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">{outfit.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.confidence.replace(
                '{score}',
                `${Math.round(outfit.confidenceScore * 100)}%`,
              )}
            </p>
          </div>
          <Heart
            className={
              outfit.isFavorite
                ? 'size-4 fill-current'
                : 'size-4 text-muted-foreground'
            }
          />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {outfit.overallExplanation}
        </p>
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
    </article>
  )
}

function RatingPreview({ dictionary }: { dictionary: Dictionary }) {
  return (
    <div
      className="flex items-center gap-1"
      aria-label={dictionary.outfits.rating}
    >
      {['1', '2', '3', '4', '5'].map((rating) => (
        <Button key={rating} type="button" variant="ghost" size="icon">
          <Star className="size-4" />
        </Button>
      ))}
    </div>
  )
}
