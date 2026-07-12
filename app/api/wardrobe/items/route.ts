import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  apiError,
  getDatabaseErrorDetail,
  isDatabaseSchemaError,
  logDev,
  type ApiErrorCode,
} from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { getBackgroundRemovalProvider } from '@/lib/background-removal'
import { db } from '@/lib/db'
import { wardrobeItem } from '@/lib/db/schema'
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

export async function GET(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const search = url.searchParams.get('search')?.trim()
  const category = url.searchParams.get('category')?.trim()
  const season = url.searchParams.get('season')?.trim()
  const style = url.searchParams.get('style')?.trim()

  const filters = [
    eq(wardrobeItem.userId, userId),
    category ? eq(wardrobeItem.category, category) : undefined,
    season ? sql`${wardrobeItem.seasons} ? ${season}` : undefined,
    style ? sql`${wardrobeItem.styles} ? ${style}` : undefined,
    search
      ? or(
          ilike(wardrobeItem.name, `%${search}%`),
          ilike(wardrobeItem.clothingType, `%${search}%`),
          ilike(wardrobeItem.brand, `%${search}%`),
          ilike(wardrobeItem.material, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean)

  const items = await db
    .select()
    .from(wardrobeItem)
    .where(and(...filters))
    .orderBy(desc(wardrobeItem.createdAt))
  const wearStats = await getWearStatsForItems(
    userId,
    items.map((item) => item.id),
  )

  return NextResponse.json({
    items: items.map((item) => toWardrobeItemDto(item, wearStats.get(item.id))),
  })
}

export async function POST(request: Request) {
  const totalStartedAt = performance.now()
  const userId = await getCurrentUserId()
  if (!userId) {
    logDev('Wardrobe create blocked: unauthenticated request')
    return apiError('unauthorized', 401)
  }

  const formData = await request.formData()
  const payloadResult = parseWardrobePayload(formData)
  if (!payloadResult.ok) {
    logDev('Wardrobe create validation failed', {
      userId,
      error: payloadResult.message,
    })
    return apiError(payloadResult.message as ApiErrorCode, payloadResult.status)
  }

  const imageEntry = formData.get('image')
  const imageResult = validateImageFile(
    imageEntry instanceof File ? imageEntry : null,
  )
  if (!imageResult.ok) {
    logDev('Wardrobe create image validation failed', {
      userId,
      error: imageResult.message,
      fileType: imageEntry instanceof File ? imageEntry.type : null,
      fileSize: imageEntry instanceof File ? imageEntry.size : null,
    })
    return apiError(imageResult.message as ApiErrorCode, imageResult.status)
  }

  let originalImage
  let processedImage
  let backgroundRemoval
  try {
    const storageStartedAt = performance.now()
    logDev('Wardrobe create storing image', {
      userId,
      fileType: imageResult.data.type,
      fileSize: imageResult.data.size,
      storageDriver: process.env.STORAGE_DRIVER ?? 'local',
    })
    originalImage = await getObjectStorage().putWardrobeImage({
      userId,
      file: imageResult.data,
      variant: 'original',
    })
    const originalImageStorageMs = Math.round(
      performance.now() - storageStartedAt,
    )

    const backgroundRemovalStartedAt = performance.now()
    logDev('Wardrobe create removing background', {
      userId,
      provider: process.env.BACKGROUND_REMOVAL_PROVIDER ?? 'mock',
    })
    backgroundRemoval = await getBackgroundRemovalProvider().removeBackground({
      userId,
      file: imageResult.data,
      mode: 'single_item',
    })
    const backgroundRemovalMs = Math.round(
      performance.now() - backgroundRemovalStartedAt,
    )

    const processedStorageStartedAt = performance.now()
    processedImage = await getObjectStorage().putWardrobeImage({
      userId,
      file: backgroundRemoval.file,
      variant: 'processed',
    })
    logDev('Wardrobe create image processing completed', {
      userId,
      originalImageStorageMs,
      backgroundRemovalMs,
      processedImageStorageMs: Math.round(
        performance.now() - processedStorageStartedAt,
      ),
      totalImageProcessingMs: Math.round(performance.now() - storageStartedAt),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    logDev('Wardrobe create storage failed', {
      userId,
      message,
      storageDriver: process.env.STORAGE_DRIVER ?? 'local',
      backgroundRemovalProvider:
        process.env.BACKGROUND_REMOVAL_PROVIDER ?? 'mock',
      nodeEnv: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL,
    })

    if (
      message.includes('background removal') ||
      message.includes('BACKGROUND_REMOVAL') ||
      message.includes('not allowed in production')
    ) {
      return apiError(
        'background_removal_not_configured',
        503,
        process.env.NODE_ENV !== 'production' ? message : undefined,
      )
    }

    return apiError('storage_write_failed', 500)
  }

  try {
    const databaseStartedAt = performance.now()
    logDev('Wardrobe create inserting database row', {
      userId,
      name: payloadResult.data.name,
      category: payloadResult.data.category,
      storageKey: processedImage.storageKey,
    })
    const [createdItem] = await db
      .insert(wardrobeItem)
      .values({
        userId,
        ...payloadResult.data,
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
        analysisStatus: 'pending',
      })
      .returning()

    logDev('Wardrobe create completed', {
      userId,
      itemId: createdItem.id,
      databaseInsertMs: Math.round(performance.now() - databaseStartedAt),
      totalDurationMs: Math.round(performance.now() - totalStartedAt),
    })

    return NextResponse.json(
      { item: toWardrobeItemDto(createdItem) },
      { status: 201 },
    )
  } catch (error) {
    const databaseErrorDetail = getDatabaseErrorDetail(error)
    logDev('Wardrobe create database insert failed', {
      userId,
      databaseErrorDetail,
    })

    const devDetail =
      process.env.NODE_ENV !== 'production' ? databaseErrorDetail : undefined

    if (isDatabaseSchemaError(error)) {
      return apiError('database_schema_mismatch', 500, devDetail ?? undefined)
    }

    return apiError('database_write_failed', 500, devDetail ?? undefined)
  }
}
