import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getBackgroundRemovalProvider } from '@/lib/background-removal'
import { db } from '@/lib/db'
import { wardrobeImageDeletionQueue, wardrobeItem } from '@/lib/db/schema'
import { getObjectStorage } from '@/lib/storage'
import { getWearStatsForItems } from '@/lib/wear/server'
import { toWardrobeItemDto } from '@/lib/wardrobe/serialize'
import {
  parseWardrobePayload,
  validateImageFile,
} from '@/lib/wardrobe/validation'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

async function getOwnedItem(userId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(wardrobeItem)
    .where(and(eq(wardrobeItem.id, itemId), eq(wardrobeItem.userId, userId)))
    .limit(1)

  return item
}

function getImageStorageKeys(item: Awaited<ReturnType<typeof getOwnedItem>>) {
  if (!item) return []

  return [
    item.imageStorageKey,
    item.originalImageStorageKey,
    item.processedImageStorageKey,
  ].filter((key, index, keys): key is string =>
    Boolean(key && keys.indexOf(key) === index),
  )
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

      const replacedKeys = getImageStorageKeys(existingItem)
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
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = (await params) as { id: string }
  const existingItem = await getOwnedItem(userId, id)
  if (!existingItem) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const storageKeys = getImageStorageKeys(existingItem)
  if (storageKeys.length > 0) {
    await db.insert(wardrobeImageDeletionQueue).values(
      storageKeys.map((storageKey) => ({
        userId,
        wardrobeItemId: existingItem.id,
        storageKey,
        reason: 'item_deleted',
      })),
    )
  }

  await db
    .delete(wardrobeItem)
    .where(and(eq(wardrobeItem.id, id), eq(wardrobeItem.userId, userId)))

  return NextResponse.json({ ok: true })
}
