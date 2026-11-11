import { and, asc, eq, or } from 'drizzle-orm'

export type PendingImageDeletion = {
  id: string
  storageKey: string
}

export type ImagePurgeDeps = {
  loadPending: (limit: number) => Promise<PendingImageDeletion[]>
  /** True when an active wardrobe item still points at this key. */
  isStillReferenced: (storageKey: string) => Promise<boolean>
  deleteObject: (storageKey: string) => Promise<void>
  markProcessed: (
    id: string,
    status: 'processed' | 'skipped' | 'failed',
  ) => Promise<void>
}

export type ImagePurgeSummary = {
  scanned: number
  deleted: number
  skippedReferenced: number
  failed: number
  dryRun: boolean
}

export async function purgePendingImageDeletions(
  deps: ImagePurgeDeps,
  options: { limit?: number; dryRun?: boolean } = {},
): Promise<ImagePurgeSummary> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500)
  const dryRun = options.dryRun ?? false
  const rows = await deps.loadPending(limit)
  const summary: ImagePurgeSummary = {
    scanned: rows.length,
    deleted: 0,
    skippedReferenced: 0,
    failed: 0,
    dryRun,
  }

  for (const row of rows) {
    // Safety: never delete an object an active item still displays.
    if (await deps.isStillReferenced(row.storageKey)) {
      summary.skippedReferenced += 1
      if (!dryRun) await deps.markProcessed(row.id, 'skipped')
      continue
    }

    if (dryRun) {
      summary.deleted += 1
      continue
    }

    try {
      await deps.deleteObject(row.storageKey)
      await deps.markProcessed(row.id, 'processed')
      summary.deleted += 1
    } catch {
      summary.failed += 1
      await deps.markProcessed(row.id, 'failed').catch(() => undefined)
    }
  }

  return summary
}

export async function createDatabaseImagePurgeDeps(): Promise<ImagePurgeDeps> {
  const { db } = await import('@/lib/db')
  const { wardrobeImageDeletionQueue, wardrobeItem } =
    await import('@/lib/db/schema')
  const { getObjectStorage } = await import('@/lib/storage')
  const storage = getObjectStorage()

  return {
    loadPending: (limit) =>
      db
        .select({
          id: wardrobeImageDeletionQueue.id,
          storageKey: wardrobeImageDeletionQueue.storageKey,
        })
        .from(wardrobeImageDeletionQueue)
        .where(eq(wardrobeImageDeletionQueue.status, 'pending'))
        .orderBy(asc(wardrobeImageDeletionQueue.requestedAt))
        .limit(limit),
    isStillReferenced: async (storageKey) => {
      const [row] = await db
        .select({ id: wardrobeItem.id })
        .from(wardrobeItem)
        .where(
          and(
            eq(wardrobeItem.imageDeletionStatus, 'active'),
            or(
              eq(wardrobeItem.imageStorageKey, storageKey),
              eq(wardrobeItem.originalImageStorageKey, storageKey),
              eq(wardrobeItem.processedImageStorageKey, storageKey),
              eq(wardrobeItem.thumbnailImageStorageKey, storageKey),
            ),
          ),
        )
        .limit(1)
      return Boolean(row)
    },
    deleteObject: (storageKey) => storage.deleteObject(storageKey),
    markProcessed: async (id, status) => {
      await db
        .update(wardrobeImageDeletionQueue)
        .set({ status, processedAt: new Date() })
        .where(eq(wardrobeImageDeletionQueue.id, id))
    },
  }
}
