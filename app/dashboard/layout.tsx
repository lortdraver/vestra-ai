import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { AppHeader } from '@/components/app-header'
import { EmailVerificationBanner } from '@/components/account/email-verification-banner'
import { PublicFooter } from '@/components/public-footer'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { eq } from 'drizzle-orm'
import { SubscriptionOverview } from '@/components/subscription/subscription-overview'
import {
  getFallbackSubscriptionSnapshot,
  getSubscriptionSnapshot,
} from '@/lib/subscription/server'
import { DASHBOARD_CONTENT_CLASS } from '@/lib/ui/responsive'

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
        userId={session.user.id}
        locale={locale}
      />
      <main className={DASHBOARD_CONTENT_CLASS}>{children}</main>
      <PublicFooter
        locale={locale}
        authenticated
        className="border-t border-border px-6 pb-[calc(env(safe-area-inset-bottom)+6.75rem)] pt-8 text-sm text-muted-foreground md:px-10 md:pb-8"
      />
    </div>
  )
}
