import { and, eq, ne } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getClothingAnalysisProvider } from '@/lib/ai'
import {
  AiProviderHttpError,
  type ClothingAnalysisWithTiming,
} from '@/lib/ai/openai-compatible-provider'
import { parseAnalysisCorrections } from '@/lib/ai/analysis-schema'
import { enhanceClothingAnalysis } from '@/lib/ai/quality'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { wardrobeItem } from '@/lib/db/schema'
import { getObjectStorage } from '@/lib/storage'
import { getWearStatsForItems } from '@/lib/wear/server'
import { toWardrobeItemDto } from '@/lib/wardrobe/serialize'

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

async function getLocalImageDataUrl(
  item: Awaited<ReturnType<typeof getOwnedItem>>,
) {
  if (!item?.imageStorageKey) {
    return {
      imageDataUrl: undefined,
      localImageReadMs: 0,
      base64ConversionMs: 0,
    }
  }

  try {
    const readStartedAt = performance.now()
    const storedObject = await getObjectStorage().getObject(
      item.imageStorageKey,
    )
    const localImageReadMs = Math.round(performance.now() - readStartedAt)
    const conversionStartedAt = performance.now()
    const imageDataUrl = `data:${storedObject.contentType};base64,${Buffer.from(
      storedObject.body,
    ).toString('base64')}`
    const base64ConversionMs = Math.round(
      performance.now() - conversionStartedAt,
    )

    return { imageDataUrl, localImageReadMs, base64ConversionMs }
  } catch {
    return {
      imageDataUrl: undefined,
      localImageReadMs: 0,
      base64ConversionMs: 0,
    }
  }
}

function logAnalysisDev(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development') return
  console.log(message, details)
}

function getAnalysisErrorCode(error: unknown) {
  if (error instanceof AiProviderHttpError) return error.detail.code

  if (
    error instanceof Error &&
    error.message.includes('Real AI provider is missing')
  ) {
    return 'ai_credentials_missing'
  }

  if (
    error instanceof Error &&
    error.message === 'ai_provider_local_image_data_url_missing'
  ) {
    return 'ai_provider_local_image_data_url_missing'
  }

  return 'analysis_failed'
}

async function toWardrobeItemDtoWithWear(
  userId: string,
  item: Awaited<ReturnType<typeof getOwnedItem>>,
) {
  if (!item) return null

  const wearStats = await getWearStatsForItems(userId, [item.id])
  return toWardrobeItemDto(item, wearStats.get(item.id))
}

export async function POST(
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

  const totalStartedAt = performance.now()
  const modelId = process.env.AI_MODEL_ID ?? 'unconfigured'
  logAnalysisDev('[dev] AI analysis started', { itemId: id, modelId })

  const [claimedItem] = await db
    .update(wardrobeItem)
    .set({
      analysisStatus: 'analyzing',
      analysisError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(wardrobeItem.id, id),
        eq(wardrobeItem.userId, userId),
        ne(wardrobeItem.analysisStatus, 'analyzing'),
      ),
    )
    .returning()

  if (!claimedItem) {
    logAnalysisDev('[dev] AI analysis duplicate skipped', {
      itemId: id,
      modelId,
      totalDurationMs: Math.round(performance.now() - totalStartedAt),
    })
    const itemDto = await toWardrobeItemDtoWithWear(userId, {
      ...item,
      analysisStatus: 'analyzing',
    })
    return NextResponse.json({ item: itemDto }, { status: 202 })
  }

  try {
    const imageReadResult = await getLocalImageDataUrl(item)
    logAnalysisDev('[dev] AI analysis image prepared', {
      itemId: item.id,
      localImageReadMs: imageReadResult.localImageReadMs,
      base64ConversionMs: imageReadResult.base64ConversionMs,
    })

    const providerStartedAt = performance.now()
    const analysisInput = {
      itemId: item.id,
      userId,
      imageUrl: item.imageUrl,
      imageDataUrl: imageReadResult.imageDataUrl,
      name: item.name,
      category: item.category,
      clothingType: item.clothingType,
      colors: item.colors,
      imageColorHints: item.imageColorHints,
    }
    const rawAnalysis = (await getClothingAnalysisProvider().analyzeClothing(
      analysisInput,
    )) as ClothingAnalysisWithTiming
    const providerDurationMs = Math.round(performance.now() - providerStartedAt)
    const providerTiming = rawAnalysis.__timing
    logAnalysisDev('[dev] AI analysis provider completed', {
      itemId: item.id,
      modelId,
      providerDurationMs,
      openRouterDurationMs: providerTiming?.openRouterDurationMs ?? null,
      responseParsingMs: providerTiming?.responseParsingMs ?? null,
      zodValidationMs: providerTiming?.zodValidationMs ?? null,
      fallbackUsed: providerTiming?.fallbackUsed ?? false,
      requestCount: providerTiming?.requestCount ?? null,
    })

    const dbUpdateStartedAt = performance.now()
    const analysis = enhanceClothingAnalysis(rawAnalysis, analysisInput)

    const [updatedItem] = await db
      .update(wardrobeItem)
      .set({
        analysisStatus: 'done',
        aiAnalysis: analysis,
        analysisError: null,
        analysisPromptVersion: analysis.promptVersion,
        analysisModelId: analysis.modelId,
        analyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(wardrobeItem.id, id), eq(wardrobeItem.userId, userId)))
      .returning()
    const databaseUpdateMs = Math.round(performance.now() - dbUpdateStartedAt)
    const totalDurationMs = Math.round(performance.now() - totalStartedAt)

    logAnalysisDev('[dev] AI analysis completed', {
      itemId: item.id,
      modelId,
      providerDurationMs:
        providerTiming?.providerDurationMs ?? providerDurationMs,
      openRouterDurationMs: providerTiming?.openRouterDurationMs ?? null,
      responseParsingMs: providerTiming?.responseParsingMs ?? null,
      zodValidationMs: providerTiming?.zodValidationMs ?? null,
      databaseUpdateMs,
      totalDurationMs,
      fallbackUsed: providerTiming?.fallbackUsed ?? false,
      requestCount: providerTiming?.requestCount ?? null,
    })

    return NextResponse.json({
      item: await toWardrobeItemDtoWithWear(userId, updatedItem),
    })
  } catch (error) {
    const totalDurationMs = Math.round(performance.now() - totalStartedAt)
    const errorCode = getAnalysisErrorCode(error)
    console.error('Failed to analyze wardrobe item', error)
    logAnalysisDev('[dev] AI analysis failed', {
      itemId: id,
      modelId,
      status: error instanceof AiProviderHttpError ? error.detail.status : null,
      code: errorCode,
      providerDurationMs:
        error instanceof AiProviderHttpError ? error.detail.durationMs : null,
      totalDurationMs,
    })
    const detail =
      error instanceof AiProviderHttpError
        ? `HTTP ${error.detail.status}: ${error.detail.message}`
        : undefined
    const [updatedItem] = await db
      .update(wardrobeItem)
      .set({
        analysisStatus: 'failed',
        analysisError: errorCode,
        updatedAt: new Date(),
      })
      .where(and(eq(wardrobeItem.id, id), eq(wardrobeItem.userId, userId)))
      .returning()

    return NextResponse.json(
      {
        error: errorCode,
        detail: process.env.NODE_ENV !== 'production' ? detail : undefined,
        item: await toWardrobeItemDtoWithWear(userId, updatedItem),
      },
      { status: 500 },
    )
  }
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
  const item = await getOwnedItem(userId, id)
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (item.analysisStatus !== 'done' || !item.aiAnalysis) {
    return NextResponse.json({ error: 'analysis_not_ready' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  let parsed
  try {
    parsed = parseAnalysisCorrections(body)
  } catch {
    return NextResponse.json({ error: 'invalid_corrections' }, { status: 400 })
  }

  const [updatedItem] = await db
    .update(wardrobeItem)
    .set({
      userCorrections: parsed,
      updatedAt: new Date(),
    })
    .where(and(eq(wardrobeItem.id, id), eq(wardrobeItem.userId, userId)))
    .returning()

  return NextResponse.json({
    item: await toWardrobeItemDtoWithWear(userId, updatedItem),
  })
}
