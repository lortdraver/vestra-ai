'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CloudSun, LocateFixed, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Locale } from '@/lib/i18n/config'
import type { OutfitPlanDto } from '@/lib/planner'
import type { OutfitDto } from '@/lib/stylist'
import type { WeatherForecast } from '@/lib/weather'

const copy = {
  az: {
    title: 'Hava uygun kombin planlayici',
    subtitle:
      'Bugun ve hefte ucun qarderobunuzdaki real geyimlerle hava uygun plan qurun.',
    today: 'Bugun ne geyinim?',
    sevenDay: '7 gunluk plan',
    location: 'Mekan',
    locationPlaceholder: 'Seher daxil edin',
    occasion: 'Plan',
    occasionPlaceholder: 'Is, universitet, axsam...',
    useGeolocation: 'Cari mekani istifade et',
    clearLocation: 'Mekani temizle',
    generateToday: 'Bugun ucun yarat',
    planToday: 'Bugune planla',
    wearThis: 'Bunu geyin',
    regenerate: 'Yeniden yarat',
    markWorn: 'Geyinildi',
    markSkipped: 'Kecildi',
    weather: 'Hava',
    rain: 'Yagis ehtimali {value}%',
    wind: 'Kulek {value} km/s',
    highLow: 'Maks/min {high}/{low}C',
    empty: 'Hele plan yoxdur.',
    loading: 'Yuklenir...',
    errors: {
      load: 'Planlari yuklemek olmadi.',
      save: 'Plani saxlamaq olmadi.',
      generate: 'Kombin yaratmaq olmadi.',
      weather_credentials_missing: 'Hava provayderi konfiqurasiya edilmeyib.',
      weather_invalid_location: 'Mekan tapilmadi.',
      weather_rate_limited: 'Hava xidmeti limiti kecdi.',
      weather_timeout: 'Hava sorgusu vaxti bitdi.',
      weather_provider_unavailable: 'Hava xidmeti muveqqeti islemir.',
    },
  },
  en: {
    title: 'Weather-aware outfit planner',
    subtitle:
      'Plan today and the week with weather-aware outfits from your own wardrobe.',
    today: 'What should I wear today?',
    sevenDay: '7-day plan',
    location: 'Location',
    locationPlaceholder: 'Enter a city',
    occasion: 'Occasion',
    occasionPlaceholder: 'Work, university, evening...',
    useGeolocation: 'Use current location',
    clearLocation: 'Clear location',
    generateToday: 'Generate for today',
    planToday: 'Plan for today',
    wearThis: 'Wear this',
    regenerate: 'Regenerate',
    markWorn: 'Mark worn',
    markSkipped: 'Mark skipped',
    weather: 'Weather',
    rain: 'Rain chance {value}%',
    wind: 'Wind {value} km/h',
    highLow: 'High/low {high}/{low}C',
    empty: 'No plans yet.',
    loading: 'Loading...',
    errors: {
      load: 'Unable to load plans.',
      save: 'Unable to save the plan.',
      generate: 'Unable to generate outfits.',
      weather_credentials_missing: 'Weather provider is not configured.',
      weather_invalid_location: 'Location was not found.',
      weather_rate_limited: 'Weather service rate limit reached.',
      weather_timeout: 'Weather request timed out.',
      weather_provider_unavailable:
        'Weather service is temporarily unavailable.',
    },
  },
  ru: {
    title: 'Планировщик образов по погоде',
    subtitle:
      'Планируйте сегодня и неделю с образами из вещей, которые уже есть.',
    today: 'Что надеть сегодня?',
    sevenDay: 'План на 7 дней',
    location: 'Локация',
    locationPlaceholder: 'Введите город',
    occasion: 'Повод',
    occasionPlaceholder: 'Работа, университет, вечер...',
    useGeolocation: 'Использовать текущую локацию',
    clearLocation: 'Очистить локацию',
    generateToday: 'Создать на сегодня',
    planToday: 'Запланировать',
    wearThis: 'Надеть это',
    regenerate: 'Создать заново',
    markWorn: 'Отметить надетым',
    markSkipped: 'Пропустить',
    weather: 'Погода',
    rain: 'Дождь {value}%',
    wind: 'Ветер {value} км/ч',
    highLow: 'Макс/мин {high}/{low}C',
    empty: 'Планов пока нет.',
    loading: 'Загрузка...',
    errors: {
      load: 'Не удалось загрузить планы.',
      save: 'Не удалось сохранить план.',
      generate: 'Не удалось создать образы.',
      weather_credentials_missing: 'Провайдер погоды не настроен.',
      weather_invalid_location: 'Локация не найдена.',
      weather_rate_limited: 'Лимит сервиса погоды исчерпан.',
      weather_timeout: 'Запрос погоды превысил время.',
      weather_provider_unavailable: 'Сервис погоды временно недоступен.',
    },
  },
} as const

function weatherContext(forecast: WeatherForecast) {
  const day = forecast.daily[0]
  return {
    locationName: forecast.location.name,
    temperatureC: forecast.current.temperatureC,
    feelsLikeC: forecast.current.feelsLikeC,
    minTemperatureC: day?.minTemperatureC,
    maxTemperatureC: day?.maxTemperatureC,
    precipitationProbability: forecast.current.precipitationProbability,
    rainMm: forecast.current.rainMm,
    snowMm: forecast.current.snowMm,
    windKph: forecast.current.windKph,
    humidity: forecast.current.humidity,
    uvIndex: forecast.current.uvIndex,
    condition: forecast.current.condition,
    time: forecast.current.time,
    timezone: forecast.location.timezone,
  }
}

function todayIso() {
  return new Date().toISOString()
}

export function PlannerPageClient({ locale }: { locale: Locale }) {
  const t = copy[locale]
  const [locationName, setLocationName] = useState('Baku')
  const [occasion, setOccasion] = useState('')
  const [forecast, setForecast] = useState<WeatherForecast | null>(null)
  const [plans, setPlans] = useState<OutfitPlanDto[]>([])
  const [candidates, setCandidates] = useState<OutfitDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayWeather = useMemo(() => forecast?.daily[0] ?? null, [forecast])

  const loadPlans = async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const response = await fetch(
      `/api/outfit-plans?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
    )
    if (!response.ok) throw new Error('plans_failed')
    const data = (await response.json()) as { plans: OutfitPlanDto[] }
    setPlans(data.plans)
  }

  const loadWeather = async (
    input: { locationName?: string; latitude?: number; longitude?: number } = {
      locationName,
    },
  ) => {
    const params = new URLSearchParams()
    if (input.latitude != null && input.longitude != null) {
      params.set('latitude', String(input.latitude))
      params.set('longitude', String(input.longitude))
    } else {
      params.set('locationName', input.locationName || locationName)
    }
    const response = await fetch(`/api/weather?${params.toString()}`)
    const data = (await response.json()) as {
      forecast?: WeatherForecast
      error?: keyof typeof t.errors
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
    const timeout = window.setTimeout(() => {
      if (savedLocation) setLocationName(savedLocation)
      void loadPlans().catch(() => setError(t.errors.load))
      void loadWeather({ locationName: savedLocation ?? locationName }).catch(
        (weatherError) => {
          const code =
            weatherError instanceof Error
              ? (weatherError.message as keyof typeof t.errors)
              : 'weather_provider_unavailable'
          setError(t.errors[code] ?? t.errors.weather_provider_unavailable)
        },
      )
    }, 0)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const nextForecast = forecast ?? (await loadWeather())
      const response = await fetch('/api/stylist/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          message: occasion || t.today,
          occasion,
          locationName,
          dateTime: todayIso(),
          weatherContext: weatherContext(nextForecast),
        }),
      })
      const data = (await response.json()) as {
        result?: { status: string; candidates?: OutfitDto[]; message?: string }
        candidates?: OutfitDto[]
        error?: string
      }
      if (!response.ok || data.result?.status === 'insufficient_wardrobe') {
        throw new Error(data.result?.message ?? data.error ?? 'generate_failed')
      }
      setCandidates(data.result?.candidates ?? data.candidates ?? [])
    } catch (generateError) {
      setError(
        generateError instanceof Error &&
          generateError.message !== 'generate_failed'
          ? generateError.message
          : t.errors.generate,
      )
    } finally {
      setIsLoading(false)
    }
  }

  const planOutfit = async (outfit: OutfitDto) => {
    const response = await fetch('/api/outfit-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outfitId: outfit.id,
        generationBatchId: outfit.generationBatchId,
        title: outfit.title,
        occasion: occasion || outfit.occasion,
        startAt: todayIso(),
        allDay: true,
        timezone: forecast?.location.timezone ?? 'UTC',
        locationName,
        source: 'weather_suggestion',
      }),
    })
    if (!response.ok) {
      setError(t.errors.save)
      return
    }
    await loadPlans().catch(() => setError(t.errors.load))
  }

  const patchPlan = async (
    plan: OutfitPlanDto,
    patch: Partial<Pick<OutfitPlanDto, 'status'>>,
  ) => {
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

  const useGeolocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      void loadWeather({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }).catch(() => setError(t.errors.weather_invalid_location))
    })
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
          <CloudSun className="size-3.5" />
          {t.weather}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">
          {t.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="rounded-2xl border-foreground/10 shadow-sm">
          <CardContent className="grid gap-4">
            <div>
              <h2 className="font-serif text-2xl font-medium">{t.today}</h2>
              {forecast && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {forecast.location.name} -{' '}
                  {Math.round(forecast.current.temperatureC)}C -{' '}
                  {t.rain.replace(
                    '{value}',
                    String(forecast.current.precipitationProbability),
                  )}
                </p>
              )}
              {todayWeather && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.highLow
                    .replace('{high}', String(todayWeather.maxTemperatureC))
                    .replace(
                      '{low}',
                      String(todayWeather.minTemperatureC),
                    )}{' '}
                  -{' '}
                  {t.wind.replace(
                    '{value}',
                    String(forecast?.current.windKph ?? 0),
                  )}
                </p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span>{t.location}</span>
                <Input
                  value={locationName}
                  placeholder={t.locationPlaceholder}
                  onChange={(event) => setLocationName(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t.occasion}</span>
                <Input
                  value={occasion}
                  placeholder={t.occasionPlaceholder}
                  onChange={(event) => setOccasion(event.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={generate} disabled={isLoading}>
                <RefreshCw />
                {isLoading ? t.loading : t.generateToday}
              </Button>
              <Button type="button" variant="outline" onClick={useGeolocation}>
                <LocateFixed />
                {t.useGeolocation}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.localStorage.removeItem('vestra:planner-location')
                  setLocationName('')
                }}
              >
                {t.clearLocation}
              </Button>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              {candidates.map((outfit) => (
                <div
                  key={outfit.id}
                  className="rounded-xl border border-border bg-background p-3 shadow-sm"
                >
                  <h3 className="font-medium">{outfit.title}</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {outfit.overallExplanation}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void planOutfit(outfit)}
                    >
                      {t.planToday}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void planOutfit(outfit)}
                    >
                      {t.wearThis}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-foreground/10 shadow-sm">
          <CardContent>
            <h2 className="flex items-center gap-2 font-serif text-xl font-medium">
              <CalendarDays className="size-5" />
              {t.sevenDay}
            </h2>
            <div className="mt-4 grid gap-3">
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.empty}</p>
              ) : (
                plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium">{plan.title}</p>
                    <p className="text-muted-foreground">
                      {new Date(plan.startAt).toLocaleDateString()} -{' '}
                      {plan.locationName ?? locationName}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void patchPlan(plan, { status: 'worn' })}
                      >
                        {t.markWorn}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void patchPlan(plan, { status: 'skipped' })
                        }
                      >
                        {t.markSkipped}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
