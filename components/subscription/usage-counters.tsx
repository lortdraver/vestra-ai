import { AlertCircle } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type {
  SubscriptionUsageKey,
  SubscriptionUsageMeter,
} from '@/lib/subscription'
import { cn } from '@/lib/utils'

export function SubscriptionUsageCounters({
  dictionary,
  locale,
  meters,
  usageUnavailable = false,
  className,
}: {
  dictionary: Dictionary
  locale: Locale
  meters: SubscriptionUsageMeter[]
  usageUnavailable?: boolean
  className?: string
}) {
  const t = dictionary.subscription
  const copy = getUsageCounterCopy(locale)

  if (usageUnavailable) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground',
          className,
        )}
      >
        <p className="flex items-center gap-2 font-medium text-foreground">
          <AlertCircle className="size-4" aria-hidden="true" />
          {copy.usageUnavailableTitle}
        </p>
        <p className="mt-1 text-xs">{copy.usageUnavailableBody}</p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-2 sm:grid-cols-3', className)}>
      {meters.map((meter) => {
        const value =
          meter.limit === null
            ? t.unlimited.replace('{used}', String(meter.used))
            : t.meter
                .replace('{used}', String(meter.used))
                .replace('{limit}', String(meter.limit))
        const remaining =
          meter.remaining === null
            ? null
            : copy.remaining.replace('{count}', String(meter.remaining))
        const periodLabel = copy.period[meter.period]
        const resetLabel =
          meter.resetAt && meter.period === 'month'
            ? copy.resetsOn.replace(
                '{date}',
                meter.resetAt.toLocaleDateString(),
              )
            : null

        return (
          <div
            key={meter.feature}
            className="rounded-xl border border-border bg-muted/30 p-3"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {t.usage[meter.feature as SubscriptionUsageKey]}
            </p>
            <p className="mt-1 text-sm font-medium">{value}</p>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              {remaining ? `${remaining} · ${periodLabel}` : periodLabel}
            </p>
            {resetLabel ? (
              <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                {resetLabel}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function getUsageCounterCopy(locale: Locale) {
  return {
    az: {
      usageUnavailableTitle: 'İstifadə sayğacları əlçatan deyil',
      usageUnavailableBody:
        'Sayğaclar hazırda yenilənə bilmir. Məhdudiyyətlər server tərəfində qorunur.',
      remaining: '{count} qalıb',
      resetsOn: '{date} tarixində yenilənir',
      period: {
        current: 'Cari',
        month: 'Bu ay',
      },
    },
    en: {
      usageUnavailableTitle: 'Usage counters are unavailable',
      usageUnavailableBody:
        'Counters cannot be refreshed right now. Server-side limits still apply.',
      remaining: '{count} remaining',
      resetsOn: 'Resets on {date}',
      period: {
        current: 'Current',
        month: 'This month',
      },
    },
    ru: {
      usageUnavailableTitle: 'Счётчики использования недоступны',
      usageUnavailableBody:
        'Сейчас не удалось обновить счётчики. Серверные лимиты продолжают действовать.',
      remaining: 'Осталось {count}',
      resetsOn: 'Обновится {date}',
      period: {
        current: 'Текущее',
        month: 'Этот месяц',
      },
    },
  }[locale]
}
