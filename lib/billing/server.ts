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
