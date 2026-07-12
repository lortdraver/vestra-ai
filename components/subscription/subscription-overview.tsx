import { Crown, Sparkles } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { checkUsage, type SubscriptionSnapshot } from '@/lib/subscription'

const usageKeys = [
  'wardrobe_items',
  'ai_analyses_monthly',
  'stylist_requests_monthly',
] as const

export function SubscriptionOverview({
  dictionary,
  subscription,
}: {
  dictionary: Dictionary
  subscription: SubscriptionSnapshot
}) {
  const t = dictionary.subscription
  const planLabel = t.plans[subscription.plan.key]
  const trialLabel =
    subscription.isTrialActive && subscription.trialEndsAt
      ? t.trialActive.replace(
          '{date}',
          subscription.trialEndsAt.toLocaleDateString(),
        )
      : subscription.isPremium
        ? t.premiumActive
        : t.freeActive

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
      <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              {subscription.isPremium ? (
                <Crown className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {planLabel}
            </p>
            <h2 className="mt-2 font-serif text-xl font-medium">
              {subscription.isPremium ? t.premiumTitle : t.upgradeTitle}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {subscription.isPremium ? t.premiumBody : t.upgradeBody}
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {trialLabel}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            {usageKeys.map((key) => {
              const usage = checkUsage(subscription, key)
              const label = t.usage[key]
              const value =
                usage.limit === null
                  ? t.unlimited.replace('{used}', String(usage.used))
                  : t.meter
                      .replace('{used}', String(usage.used))
                      .replace('{limit}', String(usage.limit))

              return (
                <div
                  key={key}
                  className="rounded-xl border border-border bg-muted/30 p-3"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-medium">{value}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
