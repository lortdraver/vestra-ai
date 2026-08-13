'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  CloudSun,
  LocateFixed,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Locale } from '@/lib/i18n/config'
import { getPlannerCopy, plannerOccasions } from '@/lib/planner/copy'
import type { OutfitPlanDto, PlannerOccasion } from '@/lib/planner'
import type { OutfitDto } from '@/lib/stylist'
import {
  assessWeatherChange,
  normalizeWeatherForDate,
  toWeatherSnapshot,
  type NormalizedWeatherContext,
  type WeatherErrorCode,
  type WeatherForecast,
} from '@/lib/weather'

type WeatherSuitabilityLevel = 'good' | 'weak' | 'too_warm' | 'too_light'

function dateKey(date: Date | string) {
  const value = typeof date === 'string' ? new Date(date) : date
  return value.toISOString().slice(0, 10)
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getMonthDays(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

function formatDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function weatherContextForStylist(context: NormalizedWeatherContext) {
  return {
    locationName: context.locationName,
    temperatureC: context.temperatureC,
    feelsLikeC: context.feelsLikeC,
    minTemperatureC: context.minTemperatureC ?? undefined,
    maxTemperatureC: context.maxTemperatureC ?? undefined,
    precipitationProbability: context.precipitationProbability,
    rainMm: context.rainExpected ? 1 : 0,
    snowMm: context.snowExpected ? 1 : 0,
    windKph: context.windSpeedKph,
    humidity: context.humidity,
    uvIndex: null,
    condition: context.condition,
    time: new Date(context.date).toISOString(),
    timezone: context.timezone,
  }
}

function evaluateOutfitWeather(
  outfit: OutfitDto,
  weather: NormalizedWeatherContext | null,
): WeatherSuitabilityLevel {
  if (!weather) return 'weak'
  const items = outfit.items
    .map((entry) => entry.item)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const hasOuterwear = items.some((item) => item.role === 'outerwear')
  const hasBoots = items.some((item) => /boot/.test(item.subtype))
  const hasHeavyLayer = items.some((item) =>
    /coat|puffer|wool|fleece|thermal|sweater|hoodie/.test(
      [item.subtype, item.material, item.name].join(' ').toLowerCase(),
    ),
  )
  const hasLightOnly = items.every((item) => item.warmthLevel <= 2)

  if (weather.temperatureBand === 'hot' && hasHeavyLayer) return 'too_warm'
  if (
    (weather.temperatureBand === 'freezing' ||
      weather.temperatureBand === 'cold') &&
    !hasOuterwear &&
    hasLightOnly
  ) {
    return 'too_light'
  }
  if (weather.snowExpected && !hasBoots) return 'weak'
  if (weather.rainExpected && !hasOuterwear) return 'weak'
  return 'good'
}

function weatherSuitabilityMessage(
  level: WeatherSuitabilityLevel,
  t: ReturnType<typeof getPlannerCopy>,
) {
  return {
    good: t.suitable,
    weak: t.weak,
    too_warm: t.tooWarm,
    too_light: t.tooLight,
  }[level]
}

export function PlannerPageClient({ locale }: { locale: Locale }) {
  const t = getPlannerCopy(locale)
  const [locationName, setLocationName] = useState(() =>
    typeof window === 'undefined'
      ? 'Baku'
      : window.localStorage.getItem('vestra:planner-location') || 'Baku',
  )
  const [occasion, setOccasion] = useState<PlannerOccasion>('everyday')
  const [note, setNote] = useState('')
  const [forecast, setForecast] = useState<WeatherForecast | null>(null)
  const [plans, setPlans] = useState<OutfitPlanDto[]>([])
  const [savedOutfits, setSavedOutfits] = useState<OutfitDto[]>([])
  const [candidates, setCandidates] = useState<OutfitDto[]>([])
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate])
  const selectedKey = dateKey(selectedDate)
  const todayKey = dateKey(new Date())
  const tomorrowKey = dateKey(addDays(new Date(), 1))
  const weather = useMemo(
    () => (forecast ? normalizeWeatherForDate(forecast, selectedKey) : null),
    [forecast, selectedKey],
  )
  const plansByDate = useMemo(() => {
    const map = new Map<string, OutfitPlanDto[]>()
    for (const plan of plans) {
      const key = dateKey(plan.startAt)
      map.set(key, [...(map.get(key) ?? []), plan])
    }
    return map
  }, [plans])
  const selectedPlans = plansByDate.get(selectedKey) ?? []
  const selectedPlan = selectedPlans[0] ?? null
  const upcomingPlans = plans
    .filter((plan) => dateKey(plan.startAt) >= todayKey)
    .slice(0, 4)

  async function loadPlans() {
    const start = addDays(startOfDay(new Date()), -7)
    const end = addDays(startOfDay(new Date()), 45)
    const response = await fetch(
      `/api/outfit-plans?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
    )
    if (!response.ok) throw new Error('load')
    const data = (await response.json()) as { plans: OutfitPlanDto[] }
    setPlans(data.plans)
  }

  async function loadSavedOutfits() {
    const response = await fetch('/api/stylist/outfits?saved=true')
    if (!response.ok) throw new Error('saved')
    const data = (await response.json()) as { outfits: OutfitDto[] }
    setSavedOutfits(data.outfits)
  }

  async function loadWeather(
    input: { locationName?: string; latitude?: number; longitude?: number } = {
      locationName,
    },
  ) {
    const params = new URLSearchParams()
    if (input.latitude != null && input.longitude != null) {
      params.set('latitude', String(input.latitude))
      params.set('longitude', String(input.longitude))
      params.set('locationName', locationName)
    } else {
      params.set('locationName', input.locationName || locationName)
    }

    const response = await fetch(`/api/weather?${params.toString()}`)
    const data = (await response.json()) as {
      forecast?: WeatherForecast
      error?: WeatherErrorCode
    }
    if (!response.ok || !data.forecast) {
      throw new Error(data.error ?? 'weather_provider_unavailable')
    }
    setForecast(data.forecast)
    setLocationName(data.forecast.location.name)
    window.localStorage.setItem(
      'vestra:planner-location',
      data.forecast.location.name,
    )
    return data.forecast
  }

  useEffect(() => {
    const savedLocation = window.localStorage.getItem('vestra:planner-location')
    queueMicrotask(() => {
      void Promise.all([
        loadPlans(),
        loadSavedOutfits(),
        loadWeather({ locationName: savedLocation ?? locationName }).catch(
          (weatherError) => {
            const code =
              weatherError instanceof Error
                ? (weatherError.message as WeatherErrorCode)
                : 'weather_provider_unavailable'
            setError(t.errors[code] ?? t.errors.weather_provider_unavailable)
            return null
          },
        ),
      ]).catch(() => setError(t.errors.load))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function localizedError(error: unknown, fallback: string) {
    if (!(error instanceof Error)) return fallback
    return t.errors[error.message as WeatherErrorCode] ?? fallback
  }

  async function generateForDay(adaptPlan?: OutfitPlanDto) {
    setIsLoading(true)
    setError(null)
    setNotice(null)
    try {
      const nextForecast = forecast ?? (await loadWeather())
      const context = normalizeWeatherForDate(nextForecast, selectedKey)
      const response = await fetch('/api/stylist/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          message: `${t.occasions[occasion]} ${formatDate(selectedDate, locale)}`,
          occasion,
          locationName: context.locationName,
          dateTime: selectedDate.toISOString(),
          weatherContext: weatherContextForStylist(context),
          wearHistoryMode: 'avoid_recently_worn',
        }),
      })
      const data = (await response.json()) as {
        result?: { status: string; candidates?: OutfitDto[]; message?: string }
        candidates?: OutfitDto[]
        error?: string
      }
      if (!response.ok || data.result?.status !== 'success') {
        throw new Error(data.result?.message ?? data.error ?? 'generate')
      }
      const nextCandidates = (
        data.result?.candidates ??
        data.candidates ??
        []
      ).slice(0, 3)
      setCandidates(nextCandidates)
      if (adaptPlan) {
        setNotice(t.weatherChanged)
      }
    } catch (generateError) {
      setError(localizedError(generateError, t.errors.generate))
    } finally {
      setIsLoading(false)
    }
  }

  async function scheduleOutfit(
    outfit: OutfitDto,
    existingPlan?: OutfitPlanDto,
  ) {
    setError(null)
    setNotice(null)
    const context = weather
    const suitability = evaluateOutfitWeather(outfit, context)
    const metadata = context
      ? {
          weatherSnapshot: toWeatherSnapshot(context),
          weatherSuitability: {
            level: suitability,
            message: weatherSuitabilityMessage(suitability, t),
          },
        }
      : undefined
    const payload = {
      outfitId: outfit.id,
      generationBatchId: outfit.generationBatchId,
      title: outfit.title,
      occasion,
      startAt: selectedDate.toISOString(),
      allDay: true,
      timezone: context?.timezone ?? forecast?.location.timezone ?? 'UTC',
      locationName: context?.locationName ?? locationName,
      note,
      source: context ? 'weather_suggestion' : 'manual',
      metadata,
    }
    const response = await fetch(
      existingPlan
        ? `/api/outfit-plans/${existingPlan.id}`
        : '/api/outfit-plans',
      {
        method: existingPlan ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    if (!response.ok) {
      setError(t.errors.save)
      return
    }
    setNotice(t.scheduled)
    setCandidates([])
    await loadPlans().catch(() => setError(t.errors.load))
  }

  async function patchPlan(
    plan: OutfitPlanDto,
    patch: Record<string, unknown>,
  ) {
    const response = await fetch(`/api/outfit-plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      setError(t.errors.save)
      return
    }
    await loadPlans().catch(() => setError(t.errors.load))
  }

  useEffect(() => {
    if (!weather || !selectedPlan?.weatherSnapshot) return
    const change = assessWeatherChange(selectedPlan.weatherSnapshot, {
      ...toWeatherSnapshot(weather),
      condition: weather.condition,
    })
    if (change.changed && !selectedPlan.weatherChange?.changed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void patchPlan(selectedPlan, {
        metadata: {
          weatherSnapshot: selectedPlan.weatherSnapshot,
          weatherChange: {
            changed: true,
            reasons: change.reasons,
            temperatureDeltaC: change.temperatureDeltaC,
          },
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, weather?.date, selectedPlan?.id])

  async function removePlan(plan: OutfitPlanDto) {
    const response = await fetch(`/api/outfit-plans/${plan.id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      setError(t.errors.save)
      return
    }
    await loadPlans().catch(() => setError(t.errors.load))
  }

  function useGeolocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      void loadWeather({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }).catch((error) => setError(localizedError(error, t.errors.load)))
    })
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm sm:p-5">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
          <CloudSun className="size-3.5" aria-hidden="true" />
          {t.weather}
        </p>
        <h1 className="mt-2 font-serif text-2xl font-medium tracking-tight sm:text-3xl">
          {t.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </section>

      <section className="grid gap-3 rounded-2xl border border-foreground/10 bg-card p-3 shadow-sm sm:p-4 lg:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-sm">
          <span>{t.location}</span>
          <Input
            value={locationName}
            placeholder={t.locationPlaceholder}
            onChange={(event) => setLocationName(event.target.value)}
            className="text-base md:text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t.occasion}</span>
          <select
            value={occasion}
            onChange={(event) =>
              setOccasion(event.target.value as PlannerOccasion)
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-base md:text-sm"
          >
            {plannerOccasions.map((option) => (
              <option key={option} value={option}>
                {t.occasions[option]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadWeather()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t.saveLocation}
          </Button>
          <Button type="button" variant="outline" onClick={useGeolocation}>
            <LocateFixed className="size-4" aria-hidden="true" />
            {t.useGeolocation}
          </Button>
        </div>
      </section>

      {(error || notice) && (
        <p
          className={error ? 'text-sm text-destructive' : 'text-sm text-accent'}
          role={error ? 'alert' : 'status'}
        >
          {error ?? notice}
        </p>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Card className="rounded-2xl border-foreground/10 shadow-sm">
          <CardContent className="grid gap-4 p-3 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-medium">{t.month}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedDate.toLocaleDateString(locale, {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {monthDays.map((day) => {
                const key = dateKey(day)
                const planCount = plansByDate.get(key)?.length ?? 0
                const dayWeather = forecast
                  ? normalizeWeatherForDate(forecast, key)
                  : null
                const isSelected = key === selectedKey
                const isToday = key === todayKey
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(startOfDay(day))}
                    className={[
                      'min-h-20 rounded-xl border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:bg-muted',
                    ].join(' ')}
                    aria-pressed={isSelected}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium">
                        {day.getDate()}
                      </span>
                      {isToday ? (
                        <span className="size-1.5 rounded-full bg-accent" />
                      ) : null}
                    </span>
                    {dayWeather ? (
                      <span className="mt-1 block text-[0.68rem] leading-tight text-muted-foreground">
                        {t.highLow
                          .replace(
                            '{min}',
                            String(
                              Math.round(
                                dayWeather.minTemperatureC ??
                                  dayWeather.temperatureC,
                              ),
                            ),
                          )
                          .replace(
                            '{max}',
                            String(
                              Math.round(
                                dayWeather.maxTemperatureC ??
                                  dayWeather.temperatureC,
                              ),
                            ),
                          )}
                      </span>
                    ) : (
                      <span className="mt-1 block text-[0.68rem] text-muted-foreground">
                        {t.weatherUnavailable}
                      </span>
                    )}
                    {planCount > 0 ? (
                      <span className="mt-1 inline-flex rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] font-medium">
                        {t.outfitScheduled}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-foreground/10 shadow-sm">
          <CardContent className="grid gap-4 p-4 sm:p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.selectedDay}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-medium">
                {formatDate(selectedDate, locale)}
              </h2>
            </div>

            <section className="rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-sm font-semibold">{t.forecast}</h3>
              {weather ? (
                <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  <p>
                    {Math.round(weather.temperatureC)}°C ·{' '}
                    {t.feelsLike.replace(
                      '{value}',
                      String(Math.round(weather.feelsLikeC)),
                    )}
                  </p>
                  <p>
                    {t.precipitation.replace(
                      '{value}',
                      String(weather.precipitationProbability),
                    )}
                  </p>
                  <p>
                    {weather.temperatureBand} · {weather.precipitation} ·{' '}
                    {weather.wind}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.weatherUnavailable}
                </p>
              )}
            </section>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">{t.plannedOutfit}</h3>
              {selectedPlan ? (
                <div className="rounded-xl border border-border p-3">
                  <p className="font-medium">{selectedPlan.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedPlan.occasion
                      ? t.occasions[selectedPlan.occasion as PlannerOccasion]
                      : t.occasions.everyday}
                  </p>
                  {selectedPlan.weatherChange?.changed ? (
                    <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                      {t.weatherChanged}
                    </p>
                  ) : null}
                  {dateKey(selectedPlan.startAt) <= todayKey ? (
                    <div className="mt-3 grid gap-2">
                      <p className="text-sm font-medium">
                        {t.markWornQuestion}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            void patchPlan(selectedPlan, { status: 'worn' })
                          }
                          disabled={Boolean(selectedPlan.wornLoggedAt)}
                        >
                          <CheckCircle2 className="size-4" />
                          {t.markWorn}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void patchPlan(selectedPlan, { status: 'skipped' })
                          }
                        >
                          {t.markSkipped}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void generateForDay(selectedPlan)}
                    >
                      <Sparkles className="size-4" />
                      {t.adapt}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void removePlan(selectedPlan)}
                    >
                      <Trash2 className="size-4" />
                      {t.removeFromCalendar}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t.noPlannedOutfit}
                </p>
              )}
            </section>

            <label className="grid gap-1 text-sm">
              <span>{t.customNote}</span>
              <Input
                value={note}
                placeholder={t.customNotePlaceholder}
                onChange={(event) => setNote(event.target.value)}
                className="text-base md:text-sm"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void generateForDay()}
                disabled={isLoading}
              >
                <Sparkles className="size-4" />
                {isLoading ? t.loading : t.generate}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadSavedOutfits()}
              >
                {t.chooseSaved}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {candidates.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-serif text-xl font-medium">{t.candidates}</h2>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
            {candidates.map((outfit) => (
              <OutfitOptionCard
                key={outfit.id}
                outfit={outfit}
                label={weatherSuitabilityMessage(
                  evaluateOutfitWeather(outfit, weather),
                  t,
                )}
                onUse={() =>
                  void scheduleOutfit(outfit, selectedPlan ?? undefined)
                }
                buttonLabel={selectedPlan ? t.changeOutfit : t.useOutfit}
              />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Card className="rounded-2xl border-foreground/10 shadow-sm">
          <CardContent className="p-4">
            <h2 className="flex items-center gap-2 font-serif text-xl font-medium">
              <CalendarDays className="size-5" />
              {t.upcoming}
            </h2>
            <div className="mt-3 grid gap-2">
              {upcomingPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.noPlannedOutfit}
                </p>
              ) : (
                upcomingPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="rounded-xl border border-border p-3 text-left text-sm hover:bg-muted"
                    onClick={() =>
                      setSelectedDate(startOfDay(new Date(plan.startAt)))
                    }
                  >
                    <span className="font-medium">{plan.title}</span>
                    <span className="mt-1 block text-muted-foreground">
                      {dateKey(plan.startAt) === todayKey
                        ? t.today
                        : dateKey(plan.startAt) === tomorrowKey
                          ? t.tomorrow
                          : new Date(plan.startAt).toLocaleDateString(locale)}
                    </span>
                    {plan.weatherChange?.changed ? (
                      <span className="mt-1 block text-amber-700">
                        {t.weatherChanged}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-foreground/10 shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-serif text-xl font-medium">{t.savedOutfits}</h2>
            <div className="mt-3 grid gap-2">
              {savedOutfits.slice(0, 6).map((outfit) => {
                const level = evaluateOutfitWeather(outfit, weather)
                return (
                  <OutfitOptionCard
                    key={outfit.id}
                    outfit={outfit}
                    label={weatherSuitabilityMessage(level, t)}
                    onUse={() =>
                      void scheduleOutfit(outfit, selectedPlan ?? undefined)
                    }
                    buttonLabel={selectedPlan ? t.changeOutfit : t.useOutfit}
                    compact
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function OutfitOptionCard({
  outfit,
  label,
  onUse,
  buttonLabel,
  compact = false,
}: {
  outfit: OutfitDto
  label: string
  onUse: () => void
  buttonLabel: string
  compact?: boolean
}) {
  return (
    <article
      className={[
        'min-w-[260px] snap-start rounded-2xl border border-border bg-card p-3 shadow-sm',
        compact ? '' : 'md:min-w-0',
      ].join(' ')}
    >
      <h3 className="font-medium">{outfit.title}</h3>
      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
        {outfit.overallExplanation}
      </p>
      <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 flex -space-x-2 overflow-hidden">
        {outfit.items.slice(0, 4).map((entry) =>
          entry.item?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={entry.wardrobeItemId}
              src={entry.item.imageUrl}
              alt=""
              className="size-9 rounded-full border border-background bg-muted object-contain p-1"
              loading="lazy"
            />
          ) : null,
        )}
      </div>
      <Button type="button" size="sm" className="mt-3" onClick={onUse}>
        {buttonLabel}
      </Button>
    </article>
  )
}
