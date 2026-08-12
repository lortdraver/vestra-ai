import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { trackServerEvent } from '@/lib/analytics/server'
import { requireVerifiedEmailSession } from '@/lib/auth-email-verification'
import { db } from '@/lib/db'
import {
  outfit,
  outfitFeedback,
  outfitGenerationBatch,
  outfitItem,
  outfitRequest,
  stylistPreferenceProfile,
  wardrobeItem,
} from '@/lib/db/schema'
import {
  StylistProviderRequestError,
  buildLocalCandidateBatch,
  getStylistProvider,
  getStylistProviderDiagnostics,
  stylistRequestSchema,
} from '@/lib/stylist'
import {
  buildPreferenceContext,
  deriveLearnedPreferenceSignals,
  mergePreferenceSignals,
  stylistPreferenceSchema,
} from '@/lib/stylist/preferences'
import {
  finishStylistGeneration,
  getStylistGenerationKey,
  tryStartStylistGeneration,
} from '@/lib/stylist/concurrency'
import {
  buildStylistGenerateFailureDetails,
  createStylistGenerateFailurePayload,
  getStylistRequestType,
  type StylistGenerateFailureDetails,
} from '@/lib/stylist/generate-diagnostics'
import {
  getProviderCandidateNormalizationDiagnostics,
  getProviderCandidateCount,
  getProviderNormalizationSummary,
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
  withWearStats,
} from '@/lib/stylist/wardrobe'
import { getWardrobeRoleLabel } from '@/lib/wardrobe/taxonomy'
import {
  applyWeatherSuitability,
  type WeatherForecast,
  type WeatherSuitabilitySignal,
} from '@/lib/weather'
import { getWearStatsForItems } from '@/lib/wear/server'
import type {
  StylistInsufficientWardrobeResult,
  StylistRequest,
  StylistWardrobeItem,
} from '@/lib/stylist'

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

function logStylistUnprocessable(input: {
  code: string
  failingValidation: string
  details: StylistGenerateFailureDetails
  duplicateRequestState: string
  lockedItemCount: number
  requestType: string
}) {
  console.warn('[stylist-generate] 422 response', {
    code: input.code,
    failingValidation: input.failingValidation,
    eligibleItemCount: input.details.eligibleItemCount,
    requiredCategories: input.details.requiredCategories,
    availableCategories: input.details.availableCategories,
    missingCategories: input.details.missingCategories,
    duplicateRequestState: input.duplicateRequestState,
    lockedItemCount: input.lockedItemCount,
    requestType: input.requestType,
  })
}

function stylistStructuredErrorResponse(input: {
  httpStatus: number
  status: 'generation_failed' | 'insufficient_wardrobe'
  code: string
  message: string
  details: StylistGenerateFailureDetails
  retryable?: boolean
  failingValidation: string
  duplicateRequestState: string
  requestType: string
}) {
  if (input.httpStatus === 422) {
    logStylistUnprocessable({
      code: input.code,
      failingValidation: input.failingValidation,
      details: input.details,
      duplicateRequestState: input.duplicateRequestState,
      lockedItemCount: input.details.lockedItemIds.length,
      requestType: input.requestType,
    })
  }

  return NextResponse.json(
    createStylistGenerateFailurePayload({
      status: input.status,
      code: input.code,
      message: input.message,
      details: input.details,
      retryable: input.retryable,
    }),
    { status: input.httpStatus },
  )
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
    ...getProviderNormalizationSummary(input.output),
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
      getWardrobeRoleLabel(locale, value) ||
      categoryLabels[locale][value as keyof (typeof categoryLabels)['en']] ||
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
  if (input.locale === 'az') {
    return {
      status: 'insufficient_wardrobe',
      message: `Bu kombin üçün ${missing} çatışmır. Qarderoba həmin geyimləri əlavə edin və ya mövcud geyimlərin kateqoriyalarını düzəldin.`,
      missingCategories: input.missingCategories,
      availableCategories: input.availableCategories,
    }
  }

  if (input.locale === 'ru') {
    return {
      status: 'insufficient_wardrobe',
      message: `Для этого образа не хватает: ${missing}. Добавьте эти вещи в гардероб или исправьте категории существующих вещей.`,
      missingCategories: input.missingCategories,
      availableCategories: input.availableCategories,
    }
  }

  return {
    status: 'insufficient_wardrobe',
    message: `This outfit is missing ${missing}. Add those items to your wardrobe or correct the categories of existing clothes.`,
    missingCategories: input.missingCategories,
    availableCategories: input.availableCategories,
  }
  /* const message = {
    az: `Bu kombin üçün ${missing} çatışmır. Qarderoba həmin geyimləri əlavə edin və ya mövcud geyimlərin kateqoriyalarını düzəldin.`,
    en: `This outfit is missing ${missing}. Add those items to your wardrobe or correct the categories of existing clothes.`,
    ru: `Для этого образа не хватает: ${missing}. Добавьте эти вещи в гардероб или исправьте категории существующих вещей.`,
  }[input.locale]

  return {
    status: 'insufficient_wardrobe',
    message,
    missingCategories: input.missingCategories,
    availableCategories: input.availableCategories,
  } */
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
  preferenceSignals: ReturnType<typeof mergePreferenceSignals>
  lockedItemIds: string[]
  weatherSignals: WeatherSuitabilitySignal[]
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
    weatherSignals: input.weatherSignals,
  })
  const envelope = isStylistProviderEnvelope(providerOutput)
    ? providerOutput
    : undefined
  const normalizationContext = {
    locale: input.request.locale,
    request: {
      message: input.request.message,
      quickRequest: input.request.quickRequest,
    },
    wardrobeItems: input.rankedWardrobe,
  }
  const output = normalizeStylistProviderOutput(
    envelope?.output ?? providerOutput,
    normalizationContext,
  )
  console.info('[stylist-generate] provider output normalization', {
    ...getProviderNormalizationSummary(
      envelope?.output ?? providerOutput,
      normalizationContext,
    ),
    candidateDiagnostics: getProviderCandidateNormalizationDiagnostics(
      envelope?.output ?? providerOutput,
      normalizationContext,
    ),
  })
  const providerMetadata = envelope?.metadata

  const buildValidationFeedback = (error: unknown) => {
    if (!(error instanceof StylistValidationError)) {
      return ['provider_output_validation_failed']
    }

    const issueFeedback = error.issues.map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join('.')}:${issue.code}`
        : issue.code,
    )

    return [error.message, ...issueFeedback].slice(0, 8)
  }

  const enrichSuccessMetadata = (
    metadata: StylistProviderResponseMetadata | undefined,
    regenerationUsed: boolean,
  ) => ({
    retryCount: metadata?.retryCount ?? 0,
    providerRequestCount: metadata?.requestCount ?? 1,
    modelId:
      metadata?.modelId ??
      providerDiagnostics.modelId ??
      process.env.STYLIST_AI_MODEL_ID,
    durationMs: Math.round(performance.now() - startedAt),
    regenerationUsed,
  })

  const validateNormalizedOutput = (
    candidateOutput: unknown,
    metadata: StylistProviderResponseMetadata | undefined,
    regenerationUsed: boolean,
  ) => {
    try {
      const batch = validateStylistBatchResult(
        candidateOutput,
        input.rankedWardrobe,
        {
          requiredCategories: input.requiredCategories,
          lockedItemIds: input.lockedItemIds,
          request: input.request,
          preferenceSignals: input.preferenceSignals,
          weatherSignals: input.weatherSignals,
        },
      )
      if (batch.status === 'success') {
        return {
          ...batch,
          metadata: {
            ...batch.metadata,
            ...enrichSuccessMetadata(metadata, regenerationUsed),
          },
        }
      }
      return batch
    } catch (batchError) {
      logProviderValidationFailure({
        error: batchError,
        output: candidateOutput,
        metadata,
      })

      try {
        const single = validateStylistResult(
          candidateOutput,
          input.rankedWardrobe,
          {
            requiredCategories: input.requiredCategories,
            lockedItemIds: input.lockedItemIds,
            request: input.request,
            preferenceSignals: input.preferenceSignals,
            weatherSignals: input.weatherSignals,
          },
        )
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
            request: input.request,
            preferenceSignals: input.preferenceSignals,
            weatherSignals: input.weatherSignals,
          })
        }
        return single
      } catch (singleError) {
        logStylistDev('[dev] Stylist legacy output fallback rejected', {
          message:
            singleError instanceof Error ? singleError.message : 'unknown',
        })
      }

      throw batchError
    }
  }

  try {
    return validateNormalizedOutput(output, providerMetadata, false)
  } catch (batchError) {
    if (!(batchError instanceof StylistValidationError)) {
      throw batchError
    }

    const validationFeedback = buildValidationFeedback(batchError)
    console.info('[stylist-generate] controlled regeneration requested', {
      reason: batchError.message,
      validationFeedback,
    })

    const retryProviderOutput = await provider.generateOutfit({
      userId: input.userId,
      locale: input.request.locale,
      request: input.request,
      wardrobeItems: input.rankedWardrobe,
      missingItems: input.missingItems,
      candidateCount: input.candidateCount,
      preferenceContext: input.preferenceContext,
      lockedItemIds: input.lockedItemIds,
      weatherSignals: input.weatherSignals,
      strictRetry: true,
      validationFeedback,
    })
    const retryEnvelope = isStylistProviderEnvelope(retryProviderOutput)
      ? retryProviderOutput
      : undefined
    const retryOutput = normalizeStylistProviderOutput(
      retryEnvelope?.output ?? retryProviderOutput,
      normalizationContext,
    )

    console.info('[stylist-generate] provider output normalization', {
      ...getProviderNormalizationSummary(
        retryEnvelope?.output ?? retryProviderOutput,
        normalizationContext,
      ),
      candidateDiagnostics: getProviderCandidateNormalizationDiagnostics(
        retryEnvelope?.output ?? retryProviderOutput,
        normalizationContext,
      ),
      regenerationUsed: true,
    })

    return validateNormalizedOutput(retryOutput, retryEnvelope?.metadata, true)
  }
}

export async function POST(request: Request) {
  let stage: StylistGenerateStage = 'REQUEST_STARTED'
  let activeGenerationKey: string | null = null
  let currentRequest: StylistRequest | null = null
  let duplicateRequestState = 'not_checked'
  let failureDetails = buildStylistGenerateFailureDetails()
  let analyticsUserId: string | null = null

  const getRequestTypeForDiagnostics = () =>
    getStylistRequestType(currentRequest)

  try {
    logStylistStage(stage)

    const verifiedSession = await requireVerifiedEmailSession()
    if (!verifiedSession.ok) {
      return verifiedSession.response
    }
    const userId = verifiedSession.userId
    analyticsUserId = userId

    stage = 'AUTHENTICATED'
    logStylistStage(stage)

    const body = await request.json().catch(() => ({}))
    const parsed = stylistRequestSchema.safeParse(body)
    if (
      !parsed.success ||
      (!parsed.data.message && !parsed.data.quickRequest)
    ) {
      return stylistStructuredErrorResponse({
        httpStatus: 400,
        status: 'generation_failed',
        code: 'invalid_stylist_request',
        message: 'The stylist request payload is invalid.',
        details: failureDetails,
        retryable: false,
        failingValidation: parsed.success
          ? 'missing_message_or_quick_request'
          : 'request_schema',
        duplicateRequestState,
        requestType: getRequestTypeForDiagnostics(),
      })
    }
    currentRequest = parsed.data

    stage = 'REQUEST_PARSED'
    logStylistStage(stage, {
      locale: parsed.data.locale,
      hasQuickRequest: Boolean(parsed.data.quickRequest),
      lockedItemCount: parsed.data.lockedItemIds.length,
    })

    activeGenerationKey = getStylistGenerationKey(userId, parsed.data)
    duplicateRequestState = 'started'
    if (!tryStartStylistGeneration(activeGenerationKey)) {
      duplicateRequestState = 'duplicate'
      return NextResponse.json(
        {
          status: 'generation_failed',
          code: 'stylist_generation_in_progress',
          message: 'A stylist generation request is already in progress.',
          details: failureDetails,
          retryable: true,
        },
        { status: 409 },
      )
    }

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
    const wearStats = await getWearStatsForItems(
      userId,
      wardrobeRows.map((item) => item.id),
    )
    const wardrobe = withWearStats(
      wardrobeRows.map(toStylistWardrobeItem),
      wearStats,
    )
    const wardrobeById = new Map(wardrobe.map((item) => [item.id, item]))
    const [savedFavoriteOutfits, feedbackRows] = await Promise.all([
      db
        .select({
          id: outfit.id,
          isFavorite: outfit.isFavorite,
          isSaved: outfit.isSaved,
        })
        .from(outfit)
        .where(
          and(
            eq(outfit.userId, userId),
            or(eq(outfit.isFavorite, true), eq(outfit.isSaved, true)),
          ),
        )
        .limit(40),
      db
        .select({
          outfitId: outfitFeedback.outfitId,
          rating: outfitFeedback.rating,
          reasonTags: outfitFeedback.reasonTags,
        })
        .from(outfitFeedback)
        .where(eq(outfitFeedback.userId, userId))
        .orderBy(desc(outfitFeedback.createdAt))
        .limit(40),
    ])
    const relatedOutfitIds = Array.from(
      new Set([
        ...savedFavoriteOutfits.map((entry) => entry.id),
        ...feedbackRows.map((entry) => entry.outfitId),
      ]),
    )
    const relatedOutfitItems =
      relatedOutfitIds.length > 0
        ? await db
            .select()
            .from(outfitItem)
            .where(inArray(outfitItem.outfitId, relatedOutfitIds))
        : []
    const outfitItemsByOutfitId = relatedOutfitItems.reduce<
      Map<string, typeof relatedOutfitItems>
    >((accumulator, item) => {
      const items = accumulator.get(item.outfitId) ?? []
      items.push(item)
      accumulator.set(item.outfitId, items)
      return accumulator
    }, new Map())
    const learnedPreferenceSignals = deriveLearnedPreferenceSignals({
      outfits: savedFavoriteOutfits.map((entry) => ({
        isFavorite: entry.isFavorite,
        isSaved: entry.isSaved,
        items: (outfitItemsByOutfitId.get(entry.id) ?? [])
          .map((item) => wardrobeById.get(item.wardrobeItemId) ?? null)
          .filter((item): item is StylistWardrobeItem => Boolean(item)),
      })),
      feedback: feedbackRows.map((entry) => ({
        rating: entry.rating,
        reasonTags: entry.reasonTags,
        items: (outfitItemsByOutfitId.get(entry.outfitId) ?? [])
          .map((item) => wardrobeById.get(item.wardrobeItemId) ?? null)
          .filter((item): item is StylistWardrobeItem => Boolean(item)),
      })),
    })
    const resolvedPreferenceSignals = mergePreferenceSignals(
      preferenceProfile,
      learnedPreferenceSignals,
    )
    const requiredCategories = getRequiredCategoriesForStylistRequest(
      parsed.data,
    )
    const prefilteredAvailableCategories = Array.from(
      new Set(wardrobe.map((item) => item.category)),
    )
    failureDetails = buildStylistGenerateFailureDetails({
      requiredCategories,
      availableCategories: prefilteredAvailableCategories,
      missingCategories: [],
      lockedItemIds: parsed.data.lockedItemIds,
      eligibleItemCount: wardrobeRows.length,
    })
    const lockedItems = wardrobe.filter((item) => lockedItemIdSet.has(item.id))
    if (lockedItems.length !== parsed.data.lockedItemIds.length) {
      return stylistStructuredErrorResponse({
        httpStatus: 422,
        status: 'generation_failed',
        code: 'locked_item_unavailable',
        message: 'One or more locked wardrobe items are unavailable.',
        details: failureDetails,
        retryable: false,
        failingValidation: 'locked_item_ownership_or_availability',
        duplicateRequestState,
        requestType: getRequestTypeForDiagnostics(),
      })
    }
    const rankedWardrobe = [
      ...lockedItems,
      ...filterAndRankWardrobe(wardrobe, parsed.data, {
        preferenceSignals: resolvedPreferenceSignals,
        lockedItemIds: parsed.data.lockedItemIds,
      }).filter((item) => !lockedItemIdSet.has(item.id)),
    ].slice(0, 24)
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
    const candidateCount =
      new Set(weatherRankedWardrobe.map((item) => item.subtype)).size >= 5
        ? 3
        : 2
    failureDetails = buildStylistGenerateFailureDetails({
      requiredCategories,
      availableCategories,
      missingCategories: allMissingItems,
      lockedItemIds: parsed.data.lockedItemIds,
      eligibleItemCount: weatherRankedWardrobe.length,
    })

    stage = 'WARDROBE_FILTERED'
    logStylistStage(stage, {
      activeItemCount: wardrobeRows.length,
      rankedItemCount: weatherRankedWardrobe.length,
      candidateCount,
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

      return NextResponse.json({
        result: insufficient,
        status: 'insufficient_wardrobe',
        code: 'insufficient_wardrobe',
        message: insufficient.message,
        details: failureDetails,
      })
    }

    let result
    try {
      void trackServerEvent({
        eventName: 'stylist_generation_requested',
        userId,
        locale: parsed.data.locale,
        properties: {
          eligibleItemCount: weatherRankedWardrobe.length,
          hasWeatherContext: Boolean(parsed.data.weatherContext),
          requestType: getStylistRequestType(parsed.data),
        },
        dedupeKey: `stylist-request:${activeGenerationKey}`,
      })
      result = await generateAndValidateStylistBatch({
        userId,
        request: parsed.data,
        rankedWardrobe: weatherRankedWardrobe,
        missingItems: allMissingItems,
        requiredCategories,
        candidateCount,
        preferenceContext: buildPreferenceContext(preferenceProfile),
        preferenceSignals: resolvedPreferenceSignals,
        lockedItemIds: parsed.data.lockedItemIds,
        weatherSignals: weatherSuitability?.signals ?? [],
        onStage: (nextStage, details) => {
          stage = nextStage
          logStylistStage(stage, details)
        },
      })
    } catch (error) {
      void trackServerEvent({
        eventName: 'stylist_generation_failed',
        userId,
        locale: parsed.data.locale,
        properties: {
          errorCode:
            error instanceof StylistProviderRequestError
              ? error.code
              : 'invalid_provider_output',
        },
        dedupeKey: `stylist-failed:${activeGenerationKey}`,
      })
      logStylistStageFailure(stage, error)
      if (error instanceof StylistProviderRequestError) {
        return stylistStructuredErrorResponse({
          httpStatus: error.status,
          status: 'generation_failed',
          code: error.code,
          message: error.message,
          details: failureDetails,
          retryable: error.retryable,
          failingValidation: 'provider_request_error',
          duplicateRequestState,
          requestType: getRequestTypeForDiagnostics(),
        })
      }

      const message =
        error instanceof Error
          ? error.message
          : 'The stylist provider returned an invalid outfit format.'
      return stylistStructuredErrorResponse({
        httpStatus: 502,
        status: 'generation_failed',
        code:
          message === 'invalid_stylist_batch_result'
            ? 'invalid_stylist_batch_result'
            : 'invalid_provider_output',
        message,
        details: failureDetails,
        retryable: true,
        failingValidation: 'provider_output_validation',
        duplicateRequestState,
        requestType: getRequestTypeForDiagnostics(),
      })
    }

    if (result.status === 'insufficient_wardrobe') {
      await storeInsufficientRequest({
        userId,
        request: parsed.data,
        rankedItemCount: weatherRankedWardrobe.length,
        result,
      })

      return NextResponse.json({
        result,
        status: 'insufficient_wardrobe',
        code: 'insufficient_wardrobe',
        message: result.message,
        details: buildStylistGenerateFailureDetails({
          ...failureDetails,
          missingCategories: result.missingCategories,
          availableCategories: result.availableCategories,
        }),
      })
    }

    if (result.status === 'generation_failed') {
      return stylistStructuredErrorResponse({
        httpStatus: 422,
        status: 'generation_failed',
        code: 'stylist_generation_failed',
        message: result.message,
        details: failureDetails,
        retryable: result.retryable,
        failingValidation: 'provider_returned_generation_failed_result',
        duplicateRequestState,
        requestType: getRequestTypeForDiagnostics(),
      })
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
          candidateTarget: candidateCount,
        },
        status: 'completed',
        missingItems,
      })
      .returning()
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

    void trackServerEvent({
      eventName: 'stylist_generation_completed',
      userId,
      locale: parsed.data.locale,
      properties: {
        candidateCount: createdOutfits.length,
        durationMs: result.metadata.durationMs,
        modelId: result.metadata.modelId ?? 'unknown',
      },
      dedupeKey: `stylist-completed:${batchRow.id}`,
    })
    for (const createdOutfit of createdOutfits) {
      void trackServerEvent({
        eventName: 'outfit_created',
        userId,
        properties: {
          itemCount: createdOutfit.items.length,
          source: 'stylist',
        },
        dedupeKey: `outfit-created:${createdOutfit.id}`,
      })
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
    if (analyticsUserId) {
      void trackServerEvent({
        eventName: 'stylist_generation_failed',
        userId: analyticsUserId,
        properties: {
          errorCode: error instanceof Error ? error.name : 'unknown_error',
        },
        dedupeKey: activeGenerationKey
          ? `stylist-failed:${activeGenerationKey}`
          : undefined,
      })
    }
    logStylistStageFailure(stage, error)
    return stylistErrorResponse(stage, error)
  } finally {
    if (activeGenerationKey) {
      finishStylistGeneration(activeGenerationKey)
    }
  }
}
