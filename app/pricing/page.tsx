import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Check, Crown } from 'lucide-react'
import { auth } from '@/lib/auth'
import { trackServerEvent } from '@/lib/analytics/server'
import { getBillingCopy } from '@/lib/billing/copy'
import { getPaddleDiagnostics } from '@/lib/billing/paddle-config'
import { getLocale } from '@/lib/i18n/server'
import { getSubscriptionSnapshot } from '@/lib/subscription/server'
import { buttonVariants } from '@/components/ui/button'
import {
  BillingActionButton,
  ManageBillingButton,
  PaddleCheckoutButton,
} from '@/components/billing/pricing-client'
import { PublicFooter } from '@/components/public-footer'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const copy = getBillingCopy(locale)
  return { title: copy.title }
}

export default async function PricingPage() {
  const [locale, session] = await Promise.all([
    getLocale(),
    auth.api.getSession({ headers: await headers() }),
  ])
  const copy = getBillingCopy(locale)
  const paddleDiagnostics = getPaddleDiagnostics()
  const subscription = session?.user
    ? await getSubscriptionSnapshot(session.user.id)
    : null
  const hasPaddleBilling = subscription?.entitlementSource === 'paddle'
  if (session?.user) {
    void trackServerEvent({
      eventName: 'pricing_viewed',
      userId: session.user.id,
      locale,
      properties: { authenticated: true },
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:px-6">
        <section className="grid gap-3">
          {paddleDiagnostics.environment === 'sandbox' ? (
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <Crown className="size-3.5" aria-hidden="true" />
              {copy.sandboxBadge}
            </p>
          ) : null}
          <h1 className="font-serif text-4xl font-medium tracking-tight md:text-5xl">
            {copy.title}
          </h1>
          <p className="max-w-2xl text-muted-foreground">{copy.subtitle}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <PricingCard
            title={copy.free}
            price="$0"
            features={copy.features.free}
            action={
              subscription?.plan.key === 'free' ? (
                <p className="text-sm font-medium text-muted-foreground">
                  {copy.currentPlan}
                </p>
              ) : null
            }
          />
          <PricingCard
            title={copy.proMonthly}
            price={copy.monthlyPrice}
            features={copy.features.pro}
            action={
              session?.user ? (
                subscription?.paymentIssue ? (
                  <ManageBillingButton
                    label={copy.updatePaymentMethod}
                    copy={copy}
                  />
                ) : subscription?.isPremium && !hasPaddleBilling ? (
                  <CurrentPlanNote copy={copy} note={null} />
                ) : subscription?.isPremium &&
                  subscription.billingInterval === 'monthly' ? (
                  <CurrentPlanNote
                    copy={copy}
                    note={
                      subscription.cancelAtPeriodEnd && subscription.accessUntil
                        ? copy.accessUntil.replace(
                            '{date}',
                            subscription.accessUntil.toLocaleDateString(),
                          )
                        : null
                    }
                  />
                ) : subscription?.isPremium && hasPaddleBilling ? (
                  <BillingActionButton
                    endpoint="/api/billing/paddle/switch"
                    label={copy.switchToMonthly}
                    copy={copy}
                    body={{ interval: 'monthly' }}
                  />
                ) : (
                  <PaddleCheckoutButton
                    interval="monthly"
                    label={copy.upgrade}
                    copy={copy}
                  />
                )
              ) : (
                <Link href="/sign-in" className={buttonVariants()}>
                  {copy.signIn}
                </Link>
              )
            }
          />
          <PricingCard
            title={copy.proAnnual}
            price={copy.annualPrice}
            badge={copy.annualSavings}
            features={copy.features.pro}
            action={
              session?.user ? (
                subscription?.paymentIssue ? (
                  <ManageBillingButton
                    label={copy.updatePaymentMethod}
                    copy={copy}
                  />
                ) : subscription?.isPremium && !hasPaddleBilling ? (
                  <CurrentPlanNote copy={copy} note={null} />
                ) : subscription?.isPremium &&
                  subscription.billingInterval === 'annual' ? (
                  <CurrentPlanNote
                    copy={copy}
                    note={
                      subscription.cancelAtPeriodEnd && subscription.accessUntil
                        ? copy.accessUntil.replace(
                            '{date}',
                            subscription.accessUntil.toLocaleDateString(),
                          )
                        : null
                    }
                  />
                ) : subscription?.isPremium && hasPaddleBilling ? (
                  <BillingActionButton
                    endpoint="/api/billing/paddle/switch"
                    label={copy.switchToAnnual}
                    copy={copy}
                    body={{ interval: 'annual' }}
                  />
                ) : (
                  <PaddleCheckoutButton
                    interval="annual"
                    label={copy.upgrade}
                    copy={copy}
                  />
                )
              ) : (
                <Link href="/sign-in" className={buttonVariants()}>
                  {copy.signIn}
                </Link>
              )
            }
          />
        </section>
      </main>
      <PublicFooter locale={locale} />
    </div>
  )
}

function CurrentPlanNote({
  copy,
  note,
}: {
  copy: ReturnType<typeof getBillingCopy>
  note: string | null
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-muted-foreground">
        {copy.currentPlan}
      </p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}

function PricingCard({
  title,
  price,
  badge,
  features,
  action,
}: {
  title: string
  price: string
  badge?: string
  features: string[]
  action: React.ReactNode
}) {
  return (
    <article className="grid gap-5 rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-2xl font-medium">{title}</h2>
        <p className="mt-2 text-3xl font-semibold">{price}</p>
        {badge ? (
          <p className="mt-2 text-sm font-medium text-accent">{badge}</p>
        ) : null}
      </div>
      <ul className="grid gap-2 text-sm text-muted-foreground">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto">{action}</div>
    </article>
  )
}
