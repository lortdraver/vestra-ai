import { eq, inArray } from 'drizzle-orm'
import type { SubscriptionSnapshot } from '@/lib/subscription/types'
import { getWardrobeImageStorageKeys } from '@/lib/wardrobe/delete'

export class AccountDeletionBlockedError extends Error {
  constructor(readonly code: 'active_subscription') {
    super(code)
    this.name = 'AccountDeletionBlockedError'
  }
}

/**
 * A paying subscriber must cancel first; otherwise Paddle would keep billing
 * a customer whose account no longer exists.
 */
export function getAccountDeletionBlocker(
  snapshot: Pick<
    SubscriptionSnapshot,
    'isPremium' | 'entitlementSource' | 'cancelAtPeriodEnd' | 'status'
  >,
) {
  const paidAndRenewing =
    snapshot.entitlementSource === 'paddle' &&
    snapshot.isPremium &&
    !snapshot.cancelAtPeriodEnd &&
    snapshot.status !== 'canceled'
  return paidAndRenewing ? ('active_subscription' as const) : null
}

/**
 * Removes every row of personal app data for a user and queues their images
 * for purge. Runs inside Better Auth's `beforeDelete`, so Better Auth then
 * deletes `user` (cascading `session`, `account`, `wear_log`).
 *
 * Kept on purpose: `subscription`, `billing_transaction` (financial records),
 * `audit_log` (security record), and the deletion-queue rows themselves.
 * After the user row is deleted these are no longer linked to a person.
 */
export async function deleteUserAppData(userId: string) {
  const { db } = await import('@/lib/db')
  const schema = await import('@/lib/db/schema')
  const { getSubscriptionSnapshot } = await import('@/lib/subscription/server')

  const blocker = getAccountDeletionBlocker(
    await getSubscriptionSnapshot(userId),
  )
  if (blocker) throw new AccountDeletionBlockedError(blocker)

  await db.transaction(async (tx) => {
    const items = await tx
      .select({
        id: schema.wardrobeItem.id,
        imageStorageKey: schema.wardrobeItem.imageStorageKey,
        originalImageStorageKey: schema.wardrobeItem.originalImageStorageKey,
        processedImageStorageKey: schema.wardrobeItem.processedImageStorageKey,
        thumbnailImageStorageKey: schema.wardrobeItem.thumbnailImageStorageKey,
      })
      .from(schema.wardrobeItem)
      .where(eq(schema.wardrobeItem.userId, userId))

    const queueRows = items.flatMap((item) =>
      getWardrobeImageStorageKeys(item).map((storageKey) => ({
        userId,
        wardrobeItemId: item.id,
        storageKey,
        reason: 'account_deleted',
      })),
    )
    if (queueRows.length > 0) {
      await tx.insert(schema.wardrobeImageDeletionQueue).values(queueRows)
    }

    const outfitIds = (
      await tx
        .select({ id: schema.outfit.id })
        .from(schema.outfit)
        .where(eq(schema.outfit.userId, userId))
    ).map((row) => row.id)

    await tx.delete(schema.wearLog).where(eq(schema.wearLog.userId, userId))
    await tx
      .delete(schema.outfitPlan)
      .where(eq(schema.outfitPlan.userId, userId))
    await tx
      .delete(schema.outfitFeedback)
      .where(eq(schema.outfitFeedback.userId, userId))
    await tx
      .delete(schema.outfitItem)
      .where(eq(schema.outfitItem.userId, userId))
    if (outfitIds.length > 0) {
      await tx
        .delete(schema.outfitItem)
        .where(inArray(schema.outfitItem.outfitId, outfitIds))
    }
    await tx.delete(schema.outfit).where(eq(schema.outfit.userId, userId))
    await tx
      .delete(schema.outfitGenerationBatch)
      .where(eq(schema.outfitGenerationBatch.userId, userId))
    await tx
      .delete(schema.outfitRequest)
      .where(eq(schema.outfitRequest.userId, userId))
    await tx
      .delete(schema.outfitCollection)
      .where(eq(schema.outfitCollection.userId, userId))
    await tx
      .delete(schema.stylistPreferenceProfile)
      .where(eq(schema.stylistPreferenceProfile.userId, userId))
    await tx
      .delete(schema.wardrobeItem)
      .where(eq(schema.wardrobeItem.userId, userId))
    await tx
      .delete(schema.subscriptionUsage)
      .where(eq(schema.subscriptionUsage.userId, userId))
    await tx
      .delete(schema.accountRecoveryToken)
      .where(eq(schema.accountRecoveryToken.userId, userId))
    await tx
      .delete(schema.emailVerificationRequest)
      .where(eq(schema.emailVerificationRequest.userId, userId))
    await tx
      .delete(schema.analyticsEvent)
      .where(eq(schema.analyticsEvent.userId, userId))
    await tx
      .delete(schema.securityEvent)
      .where(eq(schema.securityEvent.userId, userId))
  })

  return { queuedImages: true }
}
