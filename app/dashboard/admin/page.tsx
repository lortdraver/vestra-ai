import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { count, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  auditLog,
  outfit,
  outfitRequest,
  securityEvent,
  subscription,
  user,
  wardrobeItem,
} from '@/lib/db/schema'
import { getDictionary } from '@/lib/i18n/server'
import { canAccessAdmin, normalizeRole } from '@/lib/roles'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()
  return { title: dictionary.admin.title }
}

async function countRows(query: Promise<Array<{ value: number }>>) {
  const [row] = await query
  return Number(row?.value ?? 0)
}

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [currentUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!canAccessAdmin(currentUser?.role)) notFound()

  const dictionary = await getDictionary()
  const [
    users,
    totalUsers,
    premiumUsers,
    trialUsers,
    activeSubscriptions,
    recentSecurityEvents,
    recentAuditLogs,
  ] = await Promise.all([
    db.select().from(user).orderBy(desc(user.createdAt)).limit(20),
    countRows(db.select({ value: count() }).from(user)),
    countRows(
      db
        .select({ value: count() })
        .from(subscription)
        .where(eq(subscription.planKey, 'premium')),
    ),
    countRows(
      db
        .select({ value: count() })
        .from(subscription)
        .where(eq(subscription.status, 'trialing')),
    ),
    countRows(
      db
        .select({ value: count() })
        .from(subscription)
        .where(eq(subscription.status, 'active')),
    ),
    db
      .select()
      .from(securityEvent)
      .orderBy(desc(securityEvent.createdAt))
      .limit(8),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(8),
  ])

  const userRows = await Promise.all(
    users.map(async (entry) => {
      const [wardrobeCount, outfitCount, aiUsageCount, subscriptionRows] =
        await Promise.all([
          countRows(
            db
              .select({ value: count() })
              .from(wardrobeItem)
              .where(eq(wardrobeItem.userId, entry.id)),
          ),
          countRows(
            db
              .select({ value: count() })
              .from(outfit)
              .where(eq(outfit.userId, entry.id)),
          ),
          countRows(
            db
              .select({ value: count() })
              .from(outfitRequest)
              .where(eq(outfitRequest.userId, entry.id)),
          ),
          db
            .select()
            .from(subscription)
            .where(eq(subscription.userId, entry.id))
            .limit(1),
        ])

      return {
        user: entry,
        role: normalizeRole(entry.role),
        wardrobeCount,
        outfitCount,
        aiUsageCount,
        subscriptionStatus: subscriptionRows[0]?.status ?? 'free',
      }
    }),
  )

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
        <h1 className="font-serif text-3xl font-medium">
          {dictionary.admin.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {dictionary.admin.subtitle}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <AdminStat label={dictionary.admin.totalUsers} value={totalUsers} />
        <AdminStat label={dictionary.admin.premiumUsers} value={premiumUsers} />
        <AdminStat label={dictionary.admin.trialUsers} value={trialUsers} />
        <AdminStat
          label={dictionary.admin.activeSubscriptions}
          value={activeSubscriptions}
        />
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-xl font-medium">
              {dictionary.admin.users}
            </h2>
            <p className="text-sm text-muted-foreground">
              {dictionary.admin.userSearchPlaceholder}
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">{dictionary.auth.email}</th>
                <th>{dictionary.account.registrationDate}</th>
                <th>{dictionary.admin.role}</th>
                <th>{dictionary.admin.subscriptionStatus}</th>
                <th>{dictionary.account.wardrobeCount}</th>
                <th>{dictionary.account.savedOutfitCount}</th>
                <th>{dictionary.account.aiUsage}</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((row) => (
                <tr key={row.user.id} className="border-t border-border">
                  <td className="py-3">{row.user.email}</td>
                  <td>{row.user.createdAt.toLocaleDateString()}</td>
                  <td>{dictionary.admin.roles[row.role]}</td>
                  <td>{row.subscriptionStatus}</td>
                  <td>{row.wardrobeCount}</td>
                  <td>{row.outfitCount}</td>
                  <td>{row.aiUsageCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <AdminPanel title={dictionary.admin.system}>
          <Status
            label={dictionary.admin.databaseStatus}
            value={dictionary.admin.statusOk}
          />
          <Status
            label={dictionary.admin.aiProviderStatus}
            value={dictionary.admin.statusConfigured}
          />
          <Status
            label={dictionary.admin.storageStatus}
            value={dictionary.admin.statusConfigured}
          />
        </AdminPanel>

        <AdminPanel title={dictionary.admin.securityLogs}>
          {recentSecurityEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {dictionary.admin.noLogs}
            </p>
          ) : (
            recentSecurityEvents.map((event) => (
              <Status
                key={event.id}
                label={event.eventType}
                value={event.severity}
              />
            ))
          )}
        </AdminPanel>

        <AdminPanel title={dictionary.admin.auditEvents}>
          {recentAuditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {dictionary.admin.noLogs}
            </p>
          ) : (
            recentAuditLogs.map((event) => (
              <Status
                key={event.id}
                label={event.action}
                value={event.entityType}
              />
            ))
          )}
        </AdminPanel>
      </section>

      <section className="rounded-2xl border border-dashed border-border p-5">
        <h2 className="font-serif text-xl font-medium">
          {dictionary.admin.futureStores}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {dictionary.admin.futureStoresBody}
        </p>
      </section>
    </div>
  )
}

function AdminStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-medium">{value}</p>
    </div>
  )
}

function AdminPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-5 shadow-sm">
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  )
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
