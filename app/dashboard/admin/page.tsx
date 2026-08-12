import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { AdminAnalyticsDashboard } from '@/components/admin/admin-analytics-dashboard'
import {
  getAdminAnalyticsSnapshot,
  resolveAdminRangePreset,
} from '@/lib/analytics/admin'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, securityEvent, user } from '@/lib/db/schema'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { canAccessAdmin } from '@/lib/roles'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()
  return { title: dictionary.admin.title }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [currentUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!canAccessAdmin(currentUser?.role)) notFound()

  const params = await searchParams
  const preset = resolveAdminRangePreset(
    typeof params.range === 'string' ? params.range : null,
  )
  const locale = await getLocale()
  const dictionary = await getDictionary()
  const [snapshot, recentSecurityEvents, recentAuditLogs] = await Promise.all([
    getAdminAnalyticsSnapshot(preset),
    db
      .select({
        id: securityEvent.id,
        eventType: securityEvent.eventType,
        severity: securityEvent.severity,
      })
      .from(securityEvent)
      .orderBy(desc(securityEvent.createdAt))
      .limit(8),
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
      })
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(8),
  ])

  return (
    <AdminAnalyticsDashboard
      snapshot={snapshot}
      preset={preset}
      locale={locale}
      dictionary={dictionary}
      securityEvents={recentSecurityEvents}
      auditEvents={recentAuditLogs}
    />
  )
}
