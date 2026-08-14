import { Crown, Sparkles } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { SubscriptionSnapshot } from '@/lib/subscription'
import { getSubscriptionUsageDisplayMeters } from '@/lib/subscription/usage-display'
import { SubscriptionUsageCounters } from './usage-counters'

const usageKeys = [
  'wardrobe_items',
  'ai_analyses_monthly',
  'stylist_requests_monthly',
] as const

export async function SubscriptionOverview({
  dictionary,
  subscription,
  userId,
  locale,
}: {
  dictionary: Dictionary
  subscription: SubscriptionSnapshot
  userId: string
  locale: Locale
}) {
  const t = dictionary.subscription
  const meters = await getSubscriptionUsageDisplayMeters({
    userId,
    subscription,
    features: usageKeys,
  }).catch(() => null)
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

          <SubscriptionUsageCounters
            dictionary={dictionary}
            locale={locale}
            meters={meters ?? []}
            usageUnavailable={subscription.usageUnavailable || !meters}
            className="lg:min-w-[420px]"
          />
        </div>
      </div>
    </section>
  )
}
