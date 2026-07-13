import { desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  outfit,
  outfitGenerationBatch,
  outfitItem,
  outfitRequest,
  stylistPreferenceProfile,
  wardrobeItem,
} from '@/lib/db/schema'
import {
  buildLocalCandidateBatch,
  getStylistProvider,
  getStylistProviderDiagnostics,
  stylistRequestSchema,
} from '@/lib/stylist'
import {
  buildPreferenceContext,
  stylistPreferenceSchema,
} from '@/lib/stylist/preferences'
import {
  getProviderCandidateCount,
  getProviderTopLevelKeys,
  getSanitizedProviderPreview,
  normalizeStylistProviderOutput,
  type StylistProviderEnvelope,
  type StylistProviderResponseMetadata,
} from '@/lib/stylist/provider-output'
import { toOutfitDto } from '@/lib/stylist/serialize'
import {
  StylistValidationError,
  validateStylistBatchResult,
  validateStylistResult,
} from '@/lib/stylist/validation'
import {
  filterAndRankWardrobe,
  findMissingRequiredCategories,
  getRequiredCategoriesForStylistRequest,
  getStylistWardrobeDiagnostics,
  toStylistWardrobeItem,
} from '@/lib/stylist/wardrobe'
import { applyWeatherSuitability, type WeatherForecast } from '@/lib/weather'
import type {
  StylistInsufficientWardrobeResult,
  StylistRequest,
  StylistWardrobeItem,
} from '@/lib/stylist'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

type StylistGenerateStage =
  | 'REQUEST_STARTED'
  | 'AUTHENTICATED'
  | 'REQUEST_PARSED'
  | 'PREFERENCES_LOADED'
  | 'WARDROBE_LOADED'
  | 'WARDROBE_FILTERED'
  | 'PROVIDER_SELECTED'
  | 'CLIENT_CREATED'
  | 'PROVIDER_REQUEST_STARTED'

function logStylistStage(
  stage: StylistGenerateStage,
  details: Record<string, unknown> = {},
) {
  console.info(`[stylist-generate] ${stage}`, details)
}

function getStylistErrorDetail(error: unknown) {
  return error instanceof Error
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
}

function logStylistStageFailure(stage: StylistGenerateStage, error: unknown) {
  console.error('[stylist-generate] failed', {
    stage,
    ...getStylistErrorDetail(error),
  })
}

function stylistErrorResponse(
  stage: StylistGenerateStage,
  error: unknown,
  code = 'stylist_generation_failed',
  status = 502,
) {
  const detail = getStylistErrorDetail(error)

  return NextResponse.json(
    {
      stage,
      message: detail.message,
      code,
    },
    { status },
  )
}

function isStylistProviderEnvelope(
  value: unknown,
): value is StylistProviderEnvelope {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'output' in value &&
    'metadata' in value,
  )
}

function getValidationIssueDiagnostics(error: unknown) {
  if (!(error instanceof StylistValidationError)) return []

  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
  }))
}

function logProviderValidationFailure(input: {
  error: unknown
  output: unknown
  metadata?: StylistProviderResponseMetadata
}) {
  const details = {
    httpStatus: input.metadata?.httpStatus ?? null,
    modelId: input.metadata?.modelId ?? null,
    responseFormatMode: input.metadata?.responseFormatMode ?? null,
    topLevelKeys: getProviderTopLevelKeys(input.output),
    candidateCount: getProviderCandidateCount(input.output),
    zodIssues: getValidationIssueDiagnostics(input.error),
    fallbackUsed: input.metadata?.fallbackUsed ?? false,
    retryCount: input.metadata?.retryCount ?? 0,
    requestCount: input.metadata?.requestCount ?? 1,
    sanitizedPreview: getSanitizedProviderPreview(input.output),
  }

  console.warn('[stylist-generate] provider output validation failed', details)
}

const categoryLabels = {
  az: {
    tops: 'üst geyim',
    bottoms: 'alt geyim',
    shoes: 'ayaqqabı',
  },
  en: {
    tops: 'top',
    bottoms: 'bottom',
    shoes: 'shoes',
  },
  ru: {
    tops: 'верх',
    bottoms: 'низ',
    shoes: 'обувь',
  },
}

function logStylistDev(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development') return
  console.log(message, details)
}

function formatList(values: string[], locale: StylistRequest['locale']) {
  const labels = values.map(
    (value) =>
      categoryLabels[locale][value as keyof (typeof categoryLabels)['en']] ??
      value,
  )

  return labels.join(locale === 'en' ? ' and ' : ', ')
}

function buildInsufficientWardrobeResult(input: {
  locale: StylistRequest['locale']
  missingCategories: string[]
  availableCategories: string[]
  quickRequest?: string
}): StylistInsufficientWardrobeResult {
  const missing = formatList(input.missingCategories, input.locale)
  const message = {
    az: `Bu kombin üçün ${missing} çatışmır. Qarderoba həmin geyimləri əlavə edin və ya mövcud geyimlərin kateqoriyalarını düzəldin.`,
    en: `This outfit is missing ${missing}. Add those items to your wardrobe or correct the categories of existing clothes.`,
    ru: `Для этого образа не хватает: ${missing}. Добавьте эти вещи в гардероб или исправьте категории существующих вещей.`,
  }[input.locale]

  return {
    status: 'insufficient_wardrobe',
    message,
    missingCategories: input.missingCategories,
    availableCategories: input.availableCategories,
  }
}

async function storeInsufficientRequest(input: {
  userId: string
  request: StylistRequest
  rankedItemCount: number
  result: StylistInsufficientWardrobeResult
}) {
  await db.insert(outfitRequest).values({
    userId: input.userId,
    locale: input.request.locale,
    prompt: input.request.message,
    quickRequest: input.request.quickRequest,
    filters: {
      rankedItemCount: input.rankedItemCount,
      missingCategories: input.result.missingCategories,
      availableCategories: input.result.availableCategories,
    },
    status: 'insufficient_wardrobe',
    missingItems: input.result.missingCategories,
  })
}

async function generateAndValidateStylistBatch(input: {
  userId: string
  request: StylistRequest
  rankedWardrobe: StylistWardrobeItem[]
  missingItems: string[]
  requiredCategories: string[]
  candidateCount: number
  preferenceContext: string
  lockedItemIds: string[]
  onStage?: (
    stage: StylistGenerateStage,
    details?: Record<string, unknown>,
  ) => void
}) {
  const startedAt = performance.now()
  input.onStage?.('PROVIDER_SELECTED')
  const providerDiagnostics = getStylistProviderDiagnostics()
  input.onStage?.('PROVIDER_SELECTED', providerDiagnostics)
  const provider = getStylistProvider()
  input.onStage?.('CLIENT_CREATED', providerDiagnostics)

  input.onStage?.('PROVIDER_REQUEST_STARTED', {
    modelId: providerDiagnostics.modelId,
    requestUrlHost: providerDiagnostics.requestUrlHost,
  })
  const providerOutput = await provider.generateOutfit({
    userId: input.userId,
    locale: input.request.locale,
    request: input.request,
    wardrobeItems: input.rankedWardrobe,
    missingItems: input.missingItems,
    candidateCount: input.candidateCount,
    preferenceContext: input.preferenceContext,
    lockedItemIds: input.lockedItemIds,
  })
  const envelope = isStylistProviderEnvelope(providerOutput)
    ? providerOutput
    : undefined
  const output = normalizeStylistProviderOutput(
    envelope?.output ?? providerOutput,
  )
  const providerMetadata = envelope?.metadata

  try {
    const batch = validateStylistBatchResult(output, input.rankedWardrobe, {
      requiredCategories: input.requiredCategories,
      lockedItemIds: input.lockedItemIds,
    })
    if (batch.status === 'success') {
      return {
        ...batch,
        metadata: {
          ...batch.metadata,
          retryCount: providerMetadata?.retryCount ?? 0,
          providerRequestCount: providerMetadata?.requestCount ?? 1,
          modelId:
            providerMetadata?.modelId ??
            providerDiagnostics.modelId ??
            process.env.STYLIST_AI_MODEL_ID,
          durationMs: Math.round(performance.now() - startedAt),
        },
      }
    }
    return batch
  } catch (batchError) {
    logProviderValidationFailure({
      error: batchError,
      output,
      metadata: providerMetadata,
    })

    try {
      const single = validateStylistResult(output, input.rankedWardrobe, {
        requiredCategories: input.requiredCategories,
        lockedItemIds: input.lockedItemIds,
      })
      if (single.status === 'success') {
        const localBatch = buildLocalCandidateBatch({
          baseOutfit: single.outfit,
          wardrobeItems: input.rankedWardrobe,
          request: input.request,
          candidateCount: input.candidateCount,
          lockedItemIds: input.lockedItemIds,
        })
        return validateStylistBatchResult(localBatch, input.rankedWardrobe, {
          requiredCategories: input.requiredCategories,
          lockedItemIds: input.lockedItemIds,
        })
      }
      return single
    } catch (singleError) {
      logStylistDev('[dev] Stylist legacy output fallback rejected', {
        message: singleError instanceof Error ? singleError.message : 'unknown',
      })
    }

    throw batchError
  }
}

export async function POST(request: Request) {
  let stage: StylistGenerateStage = 'REQUEST_STARTED'

  try {
    logStylistStage(stage)

    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    stage = 'AUTHENTICATED'
    logStylistStage(stage)

    const body = await request.json().catch(() => ({}))
    const parsed = stylistRequestSchema.safeParse(body)
    if (
      !parsed.success ||
      (!parsed.data.message && !parsed.data.quickRequest)
    ) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    stage = 'REQUEST_PARSED'
    logStylistStage(stage, {
      locale: parsed.data.locale,
      hasQuickRequest: Boolean(parsed.data.quickRequest),
      lockedItemCount: parsed.data.lockedItemIds.length,
    })

    const [preferenceRow] = await db
      .select()
      .from(stylistPreferenceProfile)
      .where(eq(stylistPreferenceProfile.userId, userId))
      .limit(1)
    const preferenceProfile = stylistPreferenceSchema.parse(preferenceRow ?? {})
    const dislikedWardrobeItemIds = new Set(
      preferenceProfile.dislikedWardrobeItemIds,
    )

    stage = 'PREFERENCES_LOADED'
    logStylistStage(stage, {
      hasPreferenceProfile: Boolean(preferenceRow),
      dislikedItemCount: dislikedWardrobeItemIds.size,
      preferredItemCount: preferenceProfile.preferredWardrobeItemIds.length,
    })

    const allWardrobeRows = await db
      .select()
      .from(wardrobeItem)
      .where(eq(wardrobeItem.userId, userId))
      .orderBy(desc(wardrobeItem.createdAt))

    stage = 'WARDROBE_LOADED'
    logStylistStage(stage, { itemCount: allWardrobeRows.length })

    const diagnostics = getStylistWardrobeDiagnostics(allWardrobeRows)
    logStylistDev('[dev] Stylist wardrobe eligibility', diagnostics)

    const lockedItemIdSet = new Set(parsed.data.lockedItemIds)
    const wardrobeRows = allWardrobeRows.filter(
      (item) =>
        item.imageDeletionStatus === 'active' &&
        (!dislikedWardrobeItemIds.has(item.id) || lockedItemIdSet.has(item.id)),
    )
    const wardrobe = wardrobeRows.map(toStylistWardrobeItem)
    const lockedItems = wardrobe.filter((item) => lockedItemIdSet.has(item.id))
    if (lockedItems.length !== parsed.data.lockedItemIds.length) {
      return NextResponse.json(
        { error: 'locked_item_unavailable' },
        { status: 400 },
      )
    }
    const rankedWardrobe = [
      ...lockedItems,
      ...filterAndRankWardrobe(wardrobe, parsed.data).filter(
        (item) => !lockedItemIdSet.has(item.id),
      ),
    ].slice(0, 24)
    const requiredCategories = getRequiredCategoriesForStylistRequest(
      parsed.data,
    )
    const weatherSuitability = parsed.data.weatherContext
      ? applyWeatherSuitability(
          rankedWardrobe,
          {
            location: {
              name: parsed.data.weatherContext.locationName,
              latitude: 0,
              longitude: 0,
              timezone: parsed.data.weatherContext.timezone,
            },
            current: {
              time: parsed.data.weatherContext.time,
              temperatureC: parsed.data.weatherContext.temperatureC,
              feelsLikeC: parsed.data.weatherContext.feelsLikeC,
              precipitationProbability:
                parsed.data.weatherContext.precipitationProbability,
              rainMm: parsed.data.weatherContext.rainMm,
              snowMm: parsed.data.weatherContext.snowMm,
              windKph: parsed.data.weatherContext.windKph,
              humidity: parsed.data.weatherContext.humidity ?? null,
              uvIndex: parsed.data.weatherContext.uvIndex ?? null,
              condition: parsed.data.weatherContext
                .condition as WeatherForecast['current']['condition'],
            },
            hourly: [],
            daily: [
              {
                time: parsed.data.weatherContext.time,
                temperatureC: parsed.data.weatherContext.temperatureC,
                feelsLikeC: parsed.data.weatherContext.feelsLikeC,
                precipitationProbability:
                  parsed.data.weatherContext.precipitationProbability,
                rainMm: parsed.data.weatherContext.rainMm,
                snowMm: parsed.data.weatherContext.snowMm,
                windKph: parsed.data.weatherContext.windKph,
                humidity: parsed.data.weatherContext.humidity ?? null,
                uvIndex: parsed.data.weatherContext.uvIndex ?? null,
                condition: parsed.data.weatherContext
                  .condition as WeatherForecast['current']['condition'],
                minTemperatureC:
                  parsed.data.weatherContext.minTemperatureC ??
                  parsed.data.weatherContext.temperatureC,
                maxTemperatureC:
                  parsed.data.weatherContext.maxTemperatureC ??
                  parsed.data.weatherContext.temperatureC,
                sunrise: null,
                sunset: null,
              },
            ],
            fetchedAt: new Date().toISOString(),
            provider: 'request',
            stale: false,
          },
          requiredCategories,
        )
      : null
    const weatherRankedWardrobe =
      weatherSuitability && weatherSuitability.suitableItems.length > 0
        ? weatherSuitability.suitableItems
        : rankedWardrobe
    const missingItems = findMissingRequiredCategories(
      weatherRankedWardrobe,
      requiredCategories,
    )
    const missingWeatherItems = weatherSuitability?.missingCategories ?? []
    const allMissingItems = Array.from(
      new Set([...missingItems, ...missingWeatherItems]),
    )
    const availableCategories = Array.from(
      new Set(weatherRankedWardrobe.map((item) => item.category)),
    )

    stage = 'WARDROBE_FILTERED'
    logStylistStage(stage, {
      activeItemCount: wardrobeRows.length,
      rankedItemCount: weatherRankedWardrobe.length,
      lockedItemCount: lockedItems.length,
      requiredCategories,
      missingCategories: allMissingItems,
      availableCategories,
    })

    if (allMissingItems.length > 0) {
      const insufficient = buildInsufficientWardrobeResult({
        locale: parsed.data.locale,
        missingCategories: allMissingItems,
        availableCategories,
        quickRequest: parsed.data.quickRequest,
      })
      await storeInsufficientRequest({
        userId,
        request: parsed.data,
        rankedItemCount: weatherRankedWardrobe.length,
        result: insufficient,
      })

      return NextResponse.json({ result: insufficient })
    }

    let result
    try {
      result = await generateAndValidateStylistBatch({
        userId,
        request: parsed.data,
        rankedWardrobe: weatherRankedWardrobe,
        missingItems: allMissingItems,
        requiredCategories,
        candidateCount: 3,
        preferenceContext: buildPreferenceContext(preferenceProfile),
        lockedItemIds: parsed.data.lockedItemIds,
        onStage: (nextStage, details) => {
          stage = nextStage
          logStylistStage(stage, details)
        },
      })
    } catch (error) {
      logStylistStageFailure(stage, error)
      const message =
        error instanceof Error
          ? error.message
          : 'The stylist provider returned an invalid outfit format.'
      return NextResponse.json(
        {
          status: 'generation_failed',
          code:
            message === 'invalid_stylist_batch_result'
              ? 'invalid_stylist_batch_result'
              : 'invalid_provider_output',
          message,
          retryable: true,
        },
        { status: 502 },
      )
    }

    if (result.status === 'insufficient_wardrobe') {
      await storeInsufficientRequest({
        userId,
        request: parsed.data,
        rankedItemCount: weatherRankedWardrobe.length,
        result,
      })

      return NextResponse.json({ result })
    }

    if (result.status === 'generation_failed') {
      return NextResponse.json({ result }, { status: 422 })
    }

    const [requestRow] = await db
      .insert(outfitRequest)
      .values({
        userId,
        locale: parsed.data.locale,
        prompt: parsed.data.message,
        quickRequest: parsed.data.quickRequest,
        filters: {
          rankedItemCount: weatherRankedWardrobe.length,
          missingItems: allMissingItems,
          weatherSignals: weatherSuitability?.signals ?? [],
          candidateTarget: 3,
        },
        status: 'completed',
        missingItems,
      })
      .returning()

    const wardrobeById = new Map(wardrobe.map((item) => [item.id, item]))
    const [batchRow] = await db
      .insert(outfitGenerationBatch)
      .values({
        userId,
        requestId: requestRow.id,
        status: 'completed',
        candidateCount: result.candidates.length,
        providerRequestCount: result.metadata.providerRequestCount,
        retryCount: result.metadata.retryCount,
        durationMs: result.metadata.durationMs,
        modelId: result.metadata.modelId,
        promptVersion: result.metadata.promptVersion,
        schemaVersion: result.metadata.schemaVersion,
        metadata: {
          limitedVariety: result.limitedVariety,
          message: result.message,
        },
      })
      .returning()

    const createdOutfits = []
    for (const candidate of result.candidates) {
      const [outfitRow] = await db
        .insert(outfit)
        .values({
          userId,
          requestId: requestRow.id,
          generationBatchId: batchRow.id,
          title: candidate.title,
          occasion: candidate.occasion,
          styleDirection: candidate.styleDirection,
          seasonLabel: candidate.seasonLabel,
          formalityLabel: candidate.formalityLabel,
          overallExplanation: candidate.overallExplanation,
          confidenceScore: String(candidate.confidenceScore),
          alternativeSuggestions: candidate.alternativeSuggestions,
          missingItems: candidate.missingItems,
        })
        .returning()

      const itemRows = await db
        .insert(outfitItem)
        .values(
          candidate.items.map((item, index) => ({
            userId,
            outfitId: outfitRow.id,
            wardrobeItemId: item.wardrobeItemId,
            role: item.role,
            explanation: item.explanation,
            position: String(index),
          })),
        )
        .returning()

      createdOutfits.push(toOutfitDto(outfitRow, itemRows, wardrobeById))
    }

    return NextResponse.json({
      result: {
        status: 'success',
        candidates: createdOutfits,
        limitedVariety: result.limitedVariety,
        message: result.message,
        metadata: result.metadata,
        generationBatchId: batchRow.id,
      },
      outfit: createdOutfits[0],
      candidates: createdOutfits,
    })
  } catch (error) {
    logStylistStageFailure(stage, error)
    return stylistErrorResponse(stage, error)
  }
}
