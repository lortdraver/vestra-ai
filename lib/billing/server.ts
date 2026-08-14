import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscription } from '@/lib/db/schema'

export async function getLatestPaddleSubscriptionForUser(userId: string) {
  const [row] = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.userId, userId),
        eq(subscription.providerKey, 'paddle'),
      ),
    )
    .orderBy(desc(subscription.updatedAt))
    .limit(1)

  return row ?? null
}

export async function markPaddleSubscriptionOrphaned(
  row: typeof subscription.$inferSelect,
  reason:
    'missing_provider_subscription_id' | 'provider_subscription_not_found',
) {
  await db
    .update(subscription)
    .set({
      planKey: 'free',
      status: 'inactive',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      scheduledChangeAction: null,
      scheduledChangeAt: null,
      lastProviderEventAt: new Date(),
      metadata: {
        ...row.metadata,
        reconciliation: {
          reason,
          confirmedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, row.id))
}
