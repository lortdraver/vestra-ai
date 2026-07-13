import { and, count, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getBackgroundRemovalProvider } from '@/lib/background-removal'
import { db } from '@/lib/db'
import {
  outfitItem,
  stylistPreferenceProfile,
  wardrobeImageDeletionQueue,
  wardrobeItem,
  wearLogItem,
} from '@/lib/db/schema'
import { getObjectStorage } from '@/lib/storage'
import { getWearStatsForItems } from '@/lib/wear/server'
import {
  getDeleteErrorMessage,
  getWardrobeImageStorageKeys,
  toStorageCleanupStatus,
  withoutWardrobeItemId,
  type WardrobeStorageCleanupStatus,
} from '@/lib/wardrobe/delete'
import { toWardrobeItemDto } from '@/lib/wardrobe/serialize'
import {
  parseWardrobePayload,
  validateImageFile,
} from '@/lib/wardrobe/validation'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

async function getOwnedItem(
  userId: string,
  itemId: string,
  options: { includeDeleted?: boolean } = {},
) {
  const filters = [
    eq(wardrobeItem.id, itemId),
    eq(wardrobeItem.userId, userId),
    options.includeDeleted
      ? undefined
      : eq(wardrobeItem.imageDeletionStatus, 'active'),
  ].filter(Boolean)

  const [item] = await db
    .select()
    .from(wardrobeItem)
    .where(and(...filters))
    .limit(1)

  return item
}

type DeleteStage =
  | 'DELETE_REQUEST_STARTED'
  | 'AUTHENTICATED'
  | 'ITEM_LOADED'
  | 'OWNERSHIP_VERIFIED'
  | 'DEPENDENCIES_CHECKED'
  | 'DATABASE_DELETE_STARTED'
  | 'DATABASE_DELETE_COMPLETED'
  | 'STORAGE_DELETE_STARTED'
  | 'STORAGE_DELETE_COMPLETED'
  | 'SUCCESS'

function logDeleteStage(stage: DeleteStage, context?: Record<string, unknown>) {
  console.info(`[wardrobe-delete] ${stage}`, context ?? {})
}

function logDeleteError(stage: DeleteStage, error: unknown) {
  const normalized =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : {
          name: 'UnknownError',
          message: String(error),
          stack: null,
        }

  console.error('[wardrobe-delete] failed', {
    stage,
    ...normalized,
  })
}

async function countRowsByItemId(
  table:
    typeof outfitItem | typeof wearLogItem | typeof wardrobeImageDeletionQueue,
  itemId: string,
) {
  const [result] = await db
    .select({ value: count() })
    .from(table)
    .where(eq(table.wardrobeItemId, itemId))

  return Number(result?.value ?? 0)
}

async function enqueueStorageCleanup(
  userId: string,
  itemId: string,
  storageKeys: string[],
) {
  if (storageKeys.length === 0) return

  const existingRows = await db
    .select({ storageKey: wardrobeImageDeletionQueue.storageKey })
    .from(wardrobeImageDeletionQueue)
    .where(
      and(
        eq(wardrobeImageDeletionQueue.userId, userId),
        eq(wardrobeImageDeletionQueue.wardrobeItemId, itemId),
        eq(wardrobeImageDeletionQueue.status, 'pending'),
      ),
    )

  const existingKeys = new Set(existingRows.map((row) => row.storageKey))
  const newKeys = storageKeys.filter(
    (storageKey) => !existingKeys.has(storageKey),
  )
  if (newKeys.length === 0) return

  await db.insert(wardrobeImageDeletionQueue).values(
    newKeys.map((storageKey) => ({
      userId,
      wardrobeItemId: itemId,
      storageKey,
      reason: 'item_deleted',
    })),
  )
}

async function deleteStorageObjects(
  userId: string,
  itemId: string,
  storageKeys: string[],
): Promise<WardrobeStorageCleanupStatus> {
  if (storageKeys.length === 0) return 'completed'

  const failedKeys: string[] = []

  try {
    const storage = getObjectStorage()
    for (const storageKey of storageKeys) {
      try {
        await storage.deleteObject(storageKey)
      } catch (error) {
        failedKeys.push(storageKey)
        console.warn('[wardrobe-delete] storage object cleanup failed', {
          itemId,
          storageKey,
          error: getDeleteErrorMessage(error),
        })
      }
    }
  } catch (error) {
    console.warn('[wardrobe-delete] storage provider unavailable for cleanup', {
      itemId,
      error: getDeleteErrorMessage(error),
    })
    failedKeys.push(...storageKeys)
  }

  await enqueueStorageCleanup(userId, itemId, failedKeys)
  return toStorageCleanupStatus(failedKeys.length > 0)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<unknown> },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = (await params) as { id: string }
  const item = await getOwnedItem(userId, id)
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const wearStats = await getWearStatsForItems(userId, [item.id])
  return NextResponse.json({
    item: toWardrobeItemDto(item, wearStats.get(item.id)),
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<unknown> },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = (await params) as { id: string }
  const existingItem = await getOwnedItem(userId, id)
  if (!existingItem) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const formData = await request.formData()
  const payloadResult = parseWardrobePayload(formData)
  if (!payloadResult.ok) {
    return NextResponse.json(
      { error: payloadResult.message },
      { status: payloadResult.status },
    )
  }

  const imageEntry = formData.get('image')
  const hasReplacementImage = imageEntry instanceof File && imageEntry.size > 0
  let imageUpdate = {}
  const { imageColorHints, ...itemPayload } = payloadResult.data

  try {
    if (hasReplacementImage) {
      const imageResult = validateImageFile(imageEntry)
      if (!imageResult.ok) {
        return NextResponse.json(
          { error: imageResult.message },
          { status: imageResult.status },
        )
      }

      const originalImage = await getObjectStorage().putWardrobeImage({
        userId,
        file: imageResult.data,
        variant: 'original',
      })

      const backgroundRemoval =
        await getBackgroundRemovalProvider().removeBackground({
          userId,
          file: imageResult.data,
          mode: 'single_item',
        })

      const processedImage = await getObjectStorage().putWardrobeImage({
        userId,
        file: backgroundRemoval.file,
        variant: 'processed',
      })

      const replacedKeys = getWardrobeImageStorageKeys(existingItem)
      if (replacedKeys.length > 0) {
        await db.insert(wardrobeImageDeletionQueue).values(
          replacedKeys.map((storageKey) => ({
            userId,
            wardrobeItemId: existingItem.id,
            storageKey,
            reason: 'item_image_replaced',
          })),
        )
      }

      imageUpdate = {
        imageUrl: processedImage.url,
        imageStorageKey: processedImage.storageKey,
        imageContentType: processedImage.contentType,
        imageSize: String(processedImage.size),
        originalImageUrl: originalImage.url,
        originalImageStorageKey: originalImage.storageKey,
        originalImageContentType: originalImage.contentType,
        originalImageSize: String(originalImage.size),
        processedImageUrl: processedImage.url,
        processedImageStorageKey: processedImage.storageKey,
        processedImageContentType: processedImage.contentType,
        processedImageSize: String(processedImage.size),
        backgroundRemovalStatus: 'done',
        backgroundRemovalProvider: backgroundRemoval.provider,
        backgroundRemovalModelId: backgroundRemoval.modelId,
        imageColorHints,
        imageDeletionStatus: 'active',
        imageDeleteRequestedAt: null,
      }
    }

    const [updatedItem] = await db
      .update(wardrobeItem)
      .set({
        ...itemPayload,
        ...imageUpdate,
        updatedAt: new Date(),
      })
      .where(and(eq(wardrobeItem.id, id), eq(wardrobeItem.userId, userId)))
      .returning()

    const wearStats = await getWearStatsForItems(userId, [updatedItem.id])
    return NextResponse.json({
      item: toWardrobeItemDto(updatedItem, wearStats.get(updatedItem.id)),
    })
  } catch (error) {
    console.error('Failed to update wardrobe item', error)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<unknown> },
) {
  let stage: DeleteStage = 'DELETE_REQUEST_STARTED'

  try {
    logDeleteStage(stage)

    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json(
        {
          code: 'unauthorized',
          stage,
          message: 'Authentication is required.',
        },
        { status: 401 },
      )
    }

    stage = 'AUTHENTICATED'
    const { id } = (await params) as { id: string }
    logDeleteStage(stage, { itemId: id })

    const existingItem = await getOwnedItem(userId, id, {
      includeDeleted: true,
    })
    stage = 'ITEM_LOADED'
    logDeleteStage(stage, {
      itemId: id,
      found: Boolean(existingItem),
      deletionStatus: existingItem?.imageDeletionStatus ?? null,
    })

    if (!existingItem) {
      return NextResponse.json(
        {
          code: 'not_found',
          stage,
          message: 'Wardrobe item was not found.',
        },
        { status: 404 },
      )
    }

    stage = 'OWNERSHIP_VERIFIED'
    logDeleteStage(stage, { itemId: id })

    const storageKeys = getWardrobeImageStorageKeys(existingItem)
    const [outfitReferenceCount, wearReferenceCount, queuedCleanupCount] =
      await Promise.all([
        countRowsByItemId(outfitItem, id),
        countRowsByItemId(wearLogItem, id),
        countRowsByItemId(wardrobeImageDeletionQueue, id),
      ])

    stage = 'DEPENDENCIES_CHECKED'
    logDeleteStage(stage, {
      itemId: id,
      outfitReferenceCount,
      wearReferenceCount,
      queuedCleanupCount,
      storageKeyCount: storageKeys.length,
    })

    stage = 'DATABASE_DELETE_STARTED'
    logDeleteStage(stage, { itemId: id })

    await db.transaction(async (tx) => {
      const [preferences] = await tx
        .select()
        .from(stylistPreferenceProfile)
        .where(eq(stylistPreferenceProfile.userId, userId))
        .limit(1)

      if (preferences) {
        await tx
          .update(stylistPreferenceProfile)
          .set({
            preferredWardrobeItemIds: withoutWardrobeItemId(
              preferences.preferredWardrobeItemIds,
              id,
            ),
            dislikedWardrobeItemIds: withoutWardrobeItemId(
              preferences.dislikedWardrobeItemIds,
              id,
            ),
            updatedAt: new Date(),
          })
          .where(eq(stylistPreferenceProfile.userId, userId))
      }

      if (existingItem.imageDeletionStatus === 'active') {
        await tx
          .update(wardrobeItem)
          .set({
            imageDeletionStatus: 'deleted',
            imageDeleteRequestedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(wardrobeItem.id, id), eq(wardrobeItem.userId, userId)))
      }
    })

    stage = 'DATABASE_DELETE_COMPLETED'
    logDeleteStage(stage, { itemId: id })

    stage = 'STORAGE_DELETE_STARTED'
    logDeleteStage(stage, { itemId: id, storageKeyCount: storageKeys.length })
    const storageCleanup = await deleteStorageObjects(userId, id, storageKeys)

    stage = 'STORAGE_DELETE_COMPLETED'
    logDeleteStage(stage, { itemId: id, storageCleanup })

    stage = 'SUCCESS'
    logDeleteStage(stage, { itemId: id, storageCleanup })

    return NextResponse.json({
      ok: true,
      deletedItemId: id,
      storageCleanup,
    })
  } catch (error) {
    logDeleteError(stage, error)
    return NextResponse.json(
      {
        code: 'delete_failed',
        stage,
        message: getDeleteErrorMessage(error),
      },
      { status: 500 },
    )
  }
}
