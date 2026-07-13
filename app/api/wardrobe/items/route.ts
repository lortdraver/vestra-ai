import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  getDatabaseErrorDetail,
  isDatabaseSchemaError,
  logDev,
  type ApiErrorCode,
} from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { getBackgroundRemovalProvider } from '@/lib/background-removal'
import {
  BackgroundRemovalProviderError,
  type BackgroundRemovalResult,
} from '@/lib/background-removal/provider'
import { db } from '@/lib/db'
import { wardrobeItem } from '@/lib/db/schema'
import { getObjectStorage } from '@/lib/storage'
import type { ObjectStorage, StoredObject } from '@/lib/storage/types'
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

type UploadStage =
  | 'START_UPLOAD'
  | 'AUTHENTICATED'
  | 'FORM_PARSED'
  | 'PAYLOAD_VALIDATED'
  | 'IMAGE_VALIDATED'
  | 'STORAGE_DRIVER_SELECTED'
  | 'R2_CLIENT_CREATED'
  | 'BACKGROUND_PROVIDER_SELECTED'
  | 'BACKGROUND_CLIENT_CREATED'
  | 'ORIGINAL_UPLOAD_STARTED'
  | 'ORIGINAL_UPLOAD_COMPLETED'
  | 'BACKGROUND_REMOVAL_STARTED'
  | 'BACKGROUND_REMOVAL_COMPLETED'
  | 'PROCESSED_UPLOAD_STARTED'
  | 'PROCESSED_UPLOAD_COMPLETED'
  | 'DATABASE_INSERT_STARTED'
  | 'SUCCESS'

function logUploadStage(stage: UploadStage, context?: Record<string, unknown>) {
  console.info(`[upload] ${stage}`, context ?? {})
}

function logUploadError(stage: UploadStage, error: unknown) {
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

  console.error('[upload] failed', {
    stage,
    ...normalized,
  })
}

function uploadJsonError(
  code: ApiErrorCode | 'upload_unexpected_error',
  status: number,
  stage: UploadStage,
  message: string,
) {
  return NextResponse.json({ error: code, code, stage, message }, { status })
}

function getUploadErrorCode(stage: UploadStage, error: unknown): ApiErrorCode {
  const message = error instanceof Error ? error.message : ''

  if (stage === 'DATABASE_INSERT_STARTED') {
    return isDatabaseSchemaError(error)
      ? 'database_schema_mismatch'
      : 'database_write_failed'
  }

  if (
    message.includes('background removal') ||
    message.includes('BACKGROUND_REMOVAL') ||
    message.includes('not allowed in production')
  ) {
    return 'background_removal_not_configured'
  }

  return 'storage_write_failed'
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
  let stage: UploadStage = 'START_UPLOAD'
  let userId: string | null = null
  const totalStartedAt = performance.now()

  try {
    logUploadStage(stage)

    userId = await getCurrentUserId()
    if (!userId) {
      logDev('Wardrobe create blocked: unauthenticated request')
      return uploadJsonError(
        'unauthorized',
        401,
        stage,
        'Authentication is required.',
      )
    }

    stage = 'AUTHENTICATED'
    logUploadStage(stage, { userId })

    const formData = await request.formData()
    stage = 'FORM_PARSED'
    logUploadStage(stage, { userId })

    const payloadResult = parseWardrobePayload(formData)
    if (!payloadResult.ok) {
      logDev('Wardrobe create validation failed', {
        userId,
        error: payloadResult.message,
      })
      return uploadJsonError(
        payloadResult.message as ApiErrorCode,
        payloadResult.status,
        stage,
        payloadResult.message,
      )
    }

    stage = 'PAYLOAD_VALIDATED'
    logUploadStage(stage, { userId })

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
      return uploadJsonError(
        imageResult.message as ApiErrorCode,
        imageResult.status,
        stage,
        imageResult.message,
      )
    }

    stage = 'IMAGE_VALIDATED'
    logUploadStage(stage, {
      userId,
      fileType: imageResult.data.type,
      fileSize: imageResult.data.size,
    })

    const storageDriver = process.env.STORAGE_DRIVER ?? 'local'
    stage = 'STORAGE_DRIVER_SELECTED'
    logUploadStage(stage, { userId, storageDriver })
    const storage: ObjectStorage = getObjectStorage()

    stage = 'R2_CLIENT_CREATED'
    logUploadStage(stage, {
      userId,
      storageDriver,
      r2Configured:
        storageDriver === 'r2'
          ? Boolean(
              process.env.R2_BUCKET_NAME &&
              process.env.R2_ENDPOINT &&
              process.env.R2_ACCESS_KEY_ID &&
              process.env.R2_SECRET_ACCESS_KEY,
            )
          : null,
    })

    const backgroundProvider = process.env.BACKGROUND_REMOVAL_PROVIDER ?? 'mock'
    stage = 'BACKGROUND_PROVIDER_SELECTED'
    logUploadStage(stage, { userId, backgroundProvider })

    const storageStartedAt = performance.now()
    logDev('Wardrobe create storing image', {
      userId,
      fileType: imageResult.data.type,
      fileSize: imageResult.data.size,
      storageDriver: process.env.STORAGE_DRIVER ?? 'local',
    })

    stage = 'ORIGINAL_UPLOAD_STARTED'
    logUploadStage(stage, { userId, storageDriver })
    const originalImage: StoredObject = await storage.putWardrobeImage({
      userId,
      file: imageResult.data,
      variant: 'original',
    })
    stage = 'ORIGINAL_UPLOAD_COMPLETED'
    logUploadStage(stage, {
      userId,
      storageDriver,
      storageKey: originalImage.storageKey,
    })
    const originalImageStorageMs = Math.round(
      performance.now() - storageStartedAt,
    )

    const backgroundRemovalStartedAt = performance.now()
    logDev('Wardrobe create removing background', {
      userId,
      provider: process.env.BACKGROUND_REMOVAL_PROVIDER ?? 'mock',
    })

    let processedImage: StoredObject = originalImage
    let backgroundRemoval: BackgroundRemovalResult | null = null
    let backgroundRemovalStatus = 'failed'
    let backgroundRemovalError: string | null = null
    let backgroundRemovalMs = 0

    try {
      const backgroundRemovalProvider = getBackgroundRemovalProvider()
      stage = 'BACKGROUND_CLIENT_CREATED'
      logUploadStage(stage, { userId, backgroundProvider })

      stage = 'BACKGROUND_REMOVAL_STARTED'
      logUploadStage(stage, { userId, backgroundProvider })
      backgroundRemoval = await backgroundRemovalProvider.removeBackground({
        userId,
        file: imageResult.data,
        mode: 'single_item',
      })
      backgroundRemovalStatus = 'done'
      stage = 'BACKGROUND_REMOVAL_COMPLETED'
      logUploadStage(stage, {
        userId,
        backgroundProvider,
        modelId: backgroundRemoval.modelId,
      })

      const processedStorageStartedAt = performance.now()
      stage = 'PROCESSED_UPLOAD_STARTED'
      logUploadStage(stage, { userId, storageDriver })
      processedImage = await storage.putWardrobeImage({
        userId,
        file: backgroundRemoval.file,
        variant: 'processed',
      })
      stage = 'PROCESSED_UPLOAD_COMPLETED'
      logUploadStage(stage, {
        userId,
        storageDriver,
        storageKey: processedImage.storageKey,
      })
      logDev('Wardrobe create processed image stored', {
        userId,
        processedImageStorageMs: Math.round(
          performance.now() - processedStorageStartedAt,
        ),
      })
    } catch (error) {
      backgroundRemovalMs = Math.round(
        performance.now() - backgroundRemovalStartedAt,
      )
      backgroundRemovalError =
        error instanceof BackgroundRemovalProviderError
          ? error.code
          : error instanceof Error
            ? error.message
            : 'background_removal_failed'
      logUploadError(stage, error)
      logUploadStage('PROCESSED_UPLOAD_STARTED', {
        userId,
        storageDriver,
        fallback: 'original_image',
      })
      logUploadStage('PROCESSED_UPLOAD_COMPLETED', {
        userId,
        storageDriver,
        storageKey: originalImage.storageKey,
        fallback: 'original_image',
      })
    }

    backgroundRemovalMs ||= Math.round(
      performance.now() - backgroundRemovalStartedAt,
    )
    logDev('Wardrobe create image processing completed', {
      userId,
      originalImageStorageMs,
      backgroundRemovalMs,
      backgroundRemovalStatus,
      backgroundRemovalError,
      totalImageProcessingMs: Math.round(performance.now() - storageStartedAt),
    })

    const databaseStartedAt = performance.now()
    logDev('Wardrobe create inserting database row', {
      userId,
      name: payloadResult.data.name,
      category: payloadResult.data.category,
      storageKey: processedImage.storageKey,
    })

    stage = 'DATABASE_INSERT_STARTED'
    logUploadStage(stage, {
      userId,
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
        processedImageUrl:
          backgroundRemovalStatus === 'done' ? processedImage.url : null,
        processedImageStorageKey:
          backgroundRemovalStatus === 'done' ? processedImage.storageKey : null,
        processedImageContentType:
          backgroundRemovalStatus === 'done'
            ? processedImage.contentType
            : null,
        processedImageSize:
          backgroundRemovalStatus === 'done'
            ? String(processedImage.size)
            : null,
        backgroundRemovalStatus,
        backgroundRemovalProvider:
          backgroundRemoval?.provider ?? backgroundProvider,
        backgroundRemovalModelId: backgroundRemoval?.modelId ?? null,
        analysisStatus: 'pending',
      })
      .returning()

    logDev('Wardrobe create completed', {
      userId,
      itemId: createdItem.id,
      databaseInsertMs: Math.round(performance.now() - databaseStartedAt),
      totalDurationMs: Math.round(performance.now() - totalStartedAt),
    })

    stage = 'SUCCESS'
    logUploadStage(stage, {
      userId,
      itemId: createdItem.id,
      totalDurationMs: Math.round(performance.now() - totalStartedAt),
    })

    return NextResponse.json(
      { item: toWardrobeItemDto(createdItem) },
      { status: 201 },
    )
  } catch (error) {
    logUploadError(stage, error)
    const code = getUploadErrorCode(stage, error)
    const message =
      process.env.NODE_ENV === 'production'
        ? code
        : error instanceof Error
          ? error.message
          : String(error)

    logDev('Wardrobe create failed', {
      userId,
      stage,
      code,
      databaseErrorDetail: getDatabaseErrorDetail(error),
      storageDriver: process.env.STORAGE_DRIVER ?? 'local',
      backgroundRemovalProvider:
        process.env.BACKGROUND_REMOVAL_PROVIDER ?? 'mock',
      nodeEnv: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL,
    })

    return uploadJsonError(code, 500, stage, message)
  }
}
