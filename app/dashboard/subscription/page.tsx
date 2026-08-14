import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CreditCard,
  Crown,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { getBillingCopy } from '@/lib/billing/copy'
import {
  getSubscriptionPageState,
  getSubscriptionSwitchTarget,
} from '@/lib/billing/subscription-page-model'
import { getLocale } from '@/lib/i18n/server'
import { getSubscriptionSnapshot } from '@/lib/subscription/server'
import type { SubscriptionSnapshot } from '@/lib/subscription/types'
import {
  BillingActionButton,
  ManageBillingButton,
} from '@/components/billing/pricing-client'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const copy = getBillingCopy(locale)
  return { title: copy.pageTitle }
}

export default async function SubscriptionPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [locale, subscription] = await Promise.all([
    getLocale(),
    getSubscriptionSnapshot(session.user.id),
  ])
  const copy = getBillingCopy(locale)
  const state = getSubscriptionPageState(subscription)
  const switchTarget = getSubscriptionSwitchTarget(subscription)
  const isProSurface =
    state === 'active_pro' || state === 'canceling' || state === 'past_due'

  return (
    <main
      className="mx-auto grid w-full max-w-6xl gap-5 px-0 pb-24 sm:gap-6 md:pb-8"
      data-testid="subscription-page"
    >
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Crown className="size-3.5" aria-hidden="true" />
            {isProSurface ? copy.proPlanTitle : copy.freePlanTitle}
          </span>
          <StatusPill copy={copy} subscription={subscription} />
        </div>
        <div className="grid gap-2">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            {copy.pageTitle}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {copy.pageSubtitle}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-3xl border-foreground/10 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="size-5 text-accent" aria-hidden="true" />
              {isProSurface ? copy.proPlanTitle : copy.freePlanTitle}
            </CardTitle>
            <CardDescription>
              {getStateDescription(copy, state)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <PlanDetail
                label={copy.subscriptionStatus}
                value={getStatusLabel(copy, subscription)}
              />
              <PlanDetail
                label={copy.billingInterval}
                value={getIntervalLabel(copy, subscription)}
              />
              <PlanDetail
                label={
                  subscription.cancelAtPeriodEnd
                    ? copy.currentPeriodEnd
                    : copy.nextBillingDate
                }
                value={formatDate(
                  subscription.currentPeriodEnd ?? subscription.accessUntil,
                  copy.noBillingDate,
                )}
              />
              <PlanDetail
                label={copy.currentPlan}
                value={isProSurface ? copy.proPlanTitle : copy.freePlanTitle}
              />
            </div>

            {state === 'canceling' && subscription.accessUntil ? (
              <StateNotice tone="accent" icon={<CalendarClock />}>
                {copy.accessUntil.replace(
                  '{date}',
                  subscription.accessUntil.toLocaleDateString(),
                )}
              </StateNotice>
            ) : null}

            {state === 'past_due' ? (
              <StateNotice tone="destructive" icon={<AlertTriangle />}>
                {subscription.graceUntil
                  ? copy.graceUntil.replace(
                      '{date}',
                      subscription.graceUntil.toLocaleDateString(),
                    )
                  : copy.pastDueDescription}
              </StateNotice>
            ) : null}

            {state === 'paused' ? (
              <StateNotice tone="muted" icon={<RefreshCw />}>
                {copy.pausedDescription}
              </StateNotice>
            ) : null}

            {state === 'canceled' ? (
              <StateNotice tone="muted" icon={<AlertTriangle />}>
                {copy.expiredDescription}
              </StateNotice>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-foreground/10 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="size-5 text-accent" aria-hidden="true" />
              {copy.currentLimits}
            </CardTitle>
            <CardDescription>{copy.planDetails}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm text-muted-foreground">
              {(isProSurface ? copy.features.pro : copy.features.free).map(
                (feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-accent"
                      aria-hidden="true"
                    />
                    <span>{feature}</span>
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl border-foreground/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">{copy.billingActions}</CardTitle>
          <CardDescription>{copy.processingWebhook}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {state === 'free' || state === 'canceled' || state === 'paused' ? (
              <Link href="/pricing" className={buttonVariants()}>
                {state === 'canceled' ? copy.upgradeAgain : copy.upgrade}
              </Link>
            ) : null}

            {isProSurface || state === 'paused' ? (
              <ManageBillingButton
                label={
                  state === 'past_due' ? copy.updatePaymentMethod : copy.manage
                }
                copy={copy}
              />
            ) : null}

            {state === 'canceling' ? (
              <BillingActionButton
                endpoint="/api/billing/paddle/resume"
                label={copy.resume}
                copy={copy}
              />
            ) : null}

            {state === 'active_pro' || state === 'past_due' ? (
              <BillingActionButton
                endpoint="/api/billing/paddle/cancel"
                label={copy.cancel}
                copy={copy}
                variant="destructive"
                confirmMessage={copy.confirmCancel}
              />
            ) : null}

            {switchTarget ? (
              <BillingActionButton
                endpoint="/api/billing/paddle/switch"
                label={
                  switchTarget === 'annual'
                    ? copy.switchToAnnual
                    : copy.switchToMonthly
                }
                copy={copy}
                body={{ interval: switchTarget }}
              />
            ) : null}

            <Link
              href="/pricing"
              className={buttonVariants({ variant: 'outline' })}
            >
              {copy.viewPricing}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function PlanDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-muted/30 p-4">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  )
}

function StatusPill({
  copy,
  subscription,
}: {
  copy: ReturnType<typeof getBillingCopy>
  subscription: SubscriptionSnapshot
}) {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-foreground/10 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
      {getStatusLabel(copy, subscription)}
    </span>
  )
}

function StateNotice({
  children,
  icon,
  tone,
}: {
  children: ReactNode
  icon: ReactNode
  tone: 'accent' | 'destructive' | 'muted'
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm',
        tone === 'accent' &&
          'border-accent/20 bg-accent/10 text-accent-foreground',
        tone === 'destructive' &&
          'border-destructive/20 bg-destructive/10 text-destructive',
        tone === 'muted' &&
          'border-foreground/10 bg-muted/40 text-muted-foreground',
      )}
    >
      <span className="[&>svg]:mt-0.5 [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <p>{children}</p>
    </div>
  )
}

function getStateDescription(
  copy: ReturnType<typeof getBillingCopy>,
  state: ReturnType<typeof getSubscriptionPageState>,
) {
  if (state === 'canceling') return copy.cancellationScheduled
  if (state === 'past_due') return copy.pastDueDescription
  if (state === 'paused') return copy.pausedDescription
  if (state === 'canceled') return copy.expiredDescription
  return state === 'active_pro' ? copy.subtitle : copy.currentLimits
}

function getStatusLabel(
  copy: ReturnType<typeof getBillingCopy>,
  subscription: SubscriptionSnapshot,
) {
  if (subscription.paymentIssue || subscription.status === 'past_due') {
    return copy.statusPastDue
  }
  if (subscription.status === 'trialing' || subscription.isTrialActive) {
    return copy.statusTrialing
  }
  if (subscription.status === 'paused') return copy.statusPaused
  if (subscription.status === 'canceled') return copy.statusCanceled
  if (subscription.isPremium) return copy.statusActive
  return copy.statusInactive
}

function getIntervalLabel(
  copy: ReturnType<typeof getBillingCopy>,
  subscription: SubscriptionSnapshot,
) {
  if (subscription.billingInterval === 'monthly') return copy.monthly
  if (subscription.billingInterval === 'annual') return copy.annual
  return copy.free
}

function formatDate(value: Date | null | undefined, fallback: string) {
  return value ? value.toLocaleDateString() : fallback
}
