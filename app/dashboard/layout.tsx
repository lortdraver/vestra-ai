import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { AppHeader } from '@/components/app-header'
import { EmailVerificationBanner } from '@/components/account/email-verification-banner'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { eq } from 'drizzle-orm'
import { SubscriptionOverview } from '@/components/subscription/subscription-overview'
import {
  getFallbackSubscriptionSnapshot,
  getSubscriptionSnapshot,
} from '@/lib/subscription/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const [dictionary, locale, subscription, userRows] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSubscriptionSnapshot(session.user.id).catch(() =>
      getFallbackSubscriptionSnapshot(),
    ),
    db.select().from(user).where(eq(user.id, session.user.id)).limit(1),
  ])
  const currentUser = userRows[0]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          role: currentUser?.role,
          emailVerified: currentUser?.emailVerified,
          planKey: subscription.plan.key,
        }}
        dictionary={dictionary}
        locale={locale}
      />
      {!currentUser?.emailVerified && (
        <EmailVerificationBanner
          email={session.user.email}
          dictionary={dictionary}
        />
      )}
      <SubscriptionOverview
        dictionary={dictionary}
        subscription={subscription}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">
        {children}
      </main>
    </div>
  )
}
