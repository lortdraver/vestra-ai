import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { count, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  outfit,
  outfitRequest,
  subscriptionUsage,
  user,
  wardrobeItem,
} from '@/lib/db/schema'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { getSubscriptionSnapshot } from '@/lib/subscription/server'
import { LanguageSwitcher } from '@/components/language-switcher'
import { AccountActions } from '@/components/account/account-actions'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()
  return { title: dictionary.account.title }
}

async function getCount<T>(query: Promise<T[]>) {
  const [row] = (await query) as Array<{ value: number }>
  return Number(row?.value ?? 0)
}

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [dictionary, locale, subscription, userRows] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSubscriptionSnapshot(session.user.id),
    db.select().from(user).where(eq(user.id, session.user.id)).limit(1),
  ])
  const currentUser = userRows[0]
  if (!currentUser) redirect('/sign-in')

  const [wardrobeCount, savedOutfitCount, aiRequestCount, usageRows] =
    await Promise.all([
      getCount(
        db
          .select({ value: count() })
          .from(wardrobeItem)
          .where(eq(wardrobeItem.userId, session.user.id)),
      ),
      getCount(
        db
          .select({ value: count() })
          .from(outfit)
          .where(eq(outfit.userId, session.user.id)),
      ),
      getCount(
        db
          .select({ value: count() })
          .from(outfitRequest)
          .where(eq(outfitRequest.userId, session.user.id)),
      ),
      db
        .select()
        .from(subscriptionUsage)
        .where(eq(subscriptionUsage.userId, session.user.id)),
    ])

  const initials = currentUser.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const aiUsageTotal = usageRows.reduce((total, row) => total + row.used, 0)

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                {initials || dictionary.common.userFallback}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-serif text-3xl font-medium">
                {dictionary.account.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {dictionary.account.subtitle}
              </p>
            </div>
          </div>
          <LanguageSwitcher
            currentLocale={locale}
            label={dictionary.common.language}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
          <h2 className="font-serif text-xl font-medium">
            {dictionary.account.profile}
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <AccountDetail
              label={dictionary.auth.name}
              value={currentUser.name}
            />
            <AccountDetail
              label={dictionary.auth.email}
              value={currentUser.email}
            />
            <AccountDetail
              label={dictionary.account.registrationDate}
              value={currentUser.createdAt.toLocaleDateString()}
            />
            <AccountDetail
              label={dictionary.account.currentPlan}
              value={dictionary.subscription.plans[subscription.plan.key]}
            />
            <AccountDetail
              label={dictionary.account.trialStatus}
              value={
                subscription.isTrialActive && subscription.trialEndsAt
                  ? dictionary.subscription.trialActive.replace(
                      '{date}',
                      subscription.trialEndsAt.toLocaleDateString(),
                    )
                  : dictionary.subscription.freeActive
              }
            />
          </dl>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
          <h2 className="font-serif text-xl font-medium">
            {dictionary.account.statistics}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat
              label={dictionary.account.wardrobeCount}
              value={wardrobeCount}
            />
            <Stat
              label={dictionary.account.savedOutfitCount}
              value={savedOutfitCount}
            />
            <Stat
              label={dictionary.account.aiRequests}
              value={aiRequestCount}
            />
            <Stat label={dictionary.account.aiUsage} value={aiUsageTotal} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AccountCard title={dictionary.account.actions}>
          <AccountActions dictionary={dictionary} />
        </AccountCard>

        <AccountCard title={dictionary.account.security}>
          <Button type="button" variant="outline">
            {dictionary.account.changePassword}
          </Button>
          <Button type="button" variant="outline">
            {dictionary.account.emailVerification}
          </Button>
          <p className="text-sm text-muted-foreground">
            {dictionary.account.securityBody}
          </p>
        </AccountCard>
      </section>
    </div>
  )
}

function AccountDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  )
}

function AccountCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      {children}
    </div>
  )
}
