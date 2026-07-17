import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getStylistModelCapability,
  getStylistProvider,
  getStylistProviderDiagnostics,
  getStylistRequestTimeoutMs,
} from '@/lib/stylist'
import { ApiStylistProvider } from '@/lib/stylist/api-provider'
import {
  finishStylistGeneration,
  getStylistGenerationKey,
  tryStartStylistGeneration,
} from '@/lib/stylist/concurrency'
import {
  buildStylistGenerateFailureDetails,
  createStylistGenerateFailurePayload,
  getStylistRequestType,
} from '@/lib/stylist/generate-diagnostics'
import {
  normalizeStylistProviderOutput,
  parseProviderJson,
} from '@/lib/stylist/provider-output'
import {
  filterDiverseCandidates,
  getCandidateOverlap,
  validateStylistOutfit,
  validateStylistBatchResult,
  validateStylistResult,
} from '@/lib/stylist/validation'
import {
  findMissingCoreItems,
  getRequiredCategoriesForStylistRequest,
  getStylistWardrobeDiagnostics,
  hasCompleteOutfit,
  isSingleItemStylistRequest,
  normalizeStylistCategory,
} from '@/lib/stylist/wardrobe'
import type { StylistWardrobeItem } from '@/lib/stylist'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const wardrobe: StylistWardrobeItem[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'White shirt',
    category: 'tops',
    clothingType: 'shirt',
    colors: ['white'],
    seasons: ['spring'],
    styles: ['business'],
    material: 'cotton',
    brand: '',
    notes: '',
    imageUrl: '/shirt.webp',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Dark trousers',
    category: 'bottoms',
    clothingType: 'trousers',
    colors: ['black'],
    seasons: ['spring'],
    styles: ['business'],
    material: 'wool',
    brand: '',
    notes: '',
    imageUrl: '/trousers.webp',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Leather sneakers',
    category: 'shoes',
    clothingType: 'sneakers',
    colors: ['white'],
    seasons: ['spring'],
    styles: ['business'],
    material: 'leather',
    brand: '',
    notes: '',
    imageUrl: '/sneakers.webp',
  },
]

const batchCandidate = {
  title: 'Candidate',
  occasion: 'work',
  styleDirection: 'classic',
  seasonLabel: 'spring',
  formalityLabel: 'business',
  items: wardrobe.map((item) => ({
    wardrobeItemId: item.id,
    role: item.category,
    explanation: `Uses ${item.name}.`,
  })),
  overallExplanation: 'A complete outfit using owned items.',
  confidenceScore: 0.8,
  alternativeSuggestions: [],
  missingItems: [],
}

const extraWardrobe: StylistWardrobeItem[] = [
  ...wardrobe,
  {
    ...wardrobe[0],
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Blue oxford',
  },
  {
    ...wardrobe[1],
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Grey chinos',
  },
  {
    ...wardrobe[2],
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Black loafers',
  },
]

describe('stylist provider behavior', () => {
  it('allows the mock provider only when explicitly selected in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('STYLIST_AI_PROVIDER', 'mock')

    const result = validateStylistResult(
      await getStylistProvider().generateOutfit({
        userId: 'user_1',
        locale: 'en',
        request: {
          message: 'work outfit',
          locale: 'en',
          quickRequest: 'work',
          lockedItemIds: [],
          wearHistoryMode: 'none',
        },
        wardrobeItems: wardrobe,
        missingItems: [],
      }),
      wardrobe,
    )

    expect(result.status).toBe('success')
    if (result.status !== 'success') throw new Error('expected success')

    expect(result.outfit.items.map((item) => item.wardrobeItemId)).toEqual([
      wardrobe[0].id,
      wardrobe[1].id,
      wardrobe[2].id,
    ])
  })

  it('blocks the mock provider in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STYLIST_AI_PROVIDER', 'mock')

    expect(() => getStylistProvider()).toThrow(
      'Mock stylist provider is not allowed in production',
    )
  })

  it('selects the real provider in production from shared AI credentials', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STYLIST_AI_PROVIDER', undefined)
    vi.stubEnv('AI_API_KEY', 'test-key')
    vi.stubEnv('AI_API_BASE_URL', 'https://openrouter.ai/api/v1')
    vi.stubEnv('AI_MODEL_ID', 'openrouter/test-model')

    expect(getStylistProvider().constructor.name).toBe('ApiStylistProvider')
    expect(getStylistProviderDiagnostics()).toMatchObject({
      resolvedProvider: 'api',
      configuredProvider: null,
      hasApiKey: true,
      hasBaseUrl: true,
      hasModelId: true,
      modelId: 'openrouter/test-model',
      requestUrlHost: 'openrouter.ai',
    })
  })

  it('returns a clear configuration error when real credentials are missing', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STYLIST_AI_PROVIDER', 'api')
    vi.stubEnv('AI_API_KEY', '')
    vi.stubEnv('AI_API_BASE_URL', 'https://openrouter.ai/api/v1')
    vi.stubEnv('AI_MODEL_ID', '')

    expect(() => getStylistProvider()).toThrow(
      'Real stylist provider is missing required environment variables',
    )
  })

  it('does not silently fall back to mock when no provider is configured', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('STYLIST_AI_PROVIDER', undefined)
    vi.stubEnv('AI_API_KEY', '')
    vi.stubEnv('AI_API_BASE_URL', '')
    vi.stubEnv('AI_MODEL_ID', '')

    expect(() => getStylistProvider()).toThrow(
      'For local mock mode, set STYLIST_AI_PROVIDER=mock explicitly',
    )
  })

  it('falls back from strict json_schema to json_object once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'schema rejected' } }),
          {
            status: 400,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: 'success',
                    candidates: [
                      {
                        title: 'Fallback outfit',
                        description: 'A complete fallback outfit.',
                        styleDirection: 'minimal',
                        occasion: null,
                        season: null,
                        formality: null,
                        confidence: 0.8,
                        items: [
                          { wardrobeItemId: wardrobe[0].id, role: 'tops' },
                          { wardrobeItemId: wardrobe[1].id, role: 'bottoms' },
                          { wardrobeItemId: wardrobe[2].id, role: 'shoes' },
                        ],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ApiStylistProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'openrouter/test-model',
    })
    const result = await provider.generateOutfit({
      userId: 'user_1',
      locale: 'en',
      request: {
        message: 'work outfit',
        locale: 'en',
        lockedItemIds: [],
        wearHistoryMode: 'none',
      },
      wardrobeItems: wardrobe,
      missingItems: [],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.metadata).toMatchObject({
      responseFormatMode: 'json_object',
      requestCount: 2,
      retryCount: 1,
      fallbackUsed: true,
    })
  })

  it('throws when strict schema fallback still returns malformed JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '```json\n{bad json}\n```' } }],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ApiStylistProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'openrouter/test-model',
    })

    await expect(
      provider.generateOutfit({
        userId: 'user_1',
        locale: 'en',
        request: {
          message: 'work outfit',
          locale: 'en',
          lockedItemIds: [],
          wearHistoryMode: 'none',
        },
        wardrobeItems: wardrobe,
        missingItems: [],
      }),
    ).rejects.toThrow()
  })

  it('uses json_object directly for nex-agi/nex-n2-mini', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: 'generation_failed',
                  message: 'Model returned no stable outfit.',
                  retryable: true,
                }),
              },
            },
          ],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ApiStylistProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'nex-agi/nex-n2-mini',
    })

    await provider.generateOutfit({
      userId: 'user_1',
      locale: 'en',
      request: {
        message: 'work outfit',
        locale: 'en',
        lockedItemIds: [],
        wearHistoryMode: 'none',
      },
      wardrobeItems: wardrobe,
      missingItems: [],
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      response_format: { type: string }
    }
    expect(getStylistModelCapability('nex-agi/nex-n2-mini')).toMatchObject({
      supportsJsonSchema: false,
      supportsJsonObject: true,
    })
    expect(body.response_format.type).toBe('json_object')
  })

  it('times out an unresponsive provider request with AbortController', async () => {
    vi.useFakeTimers()
    vi.stubEnv('STYLIST_AI_REQUEST_TIMEOUT_MS', '5000')
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ApiStylistProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'nex-agi/nex-n2-mini',
    })
    const promise = provider.generateOutfit({
      userId: 'user_1',
      locale: 'en',
      request: {
        message: 'work outfit',
        locale: 'en',
        lockedItemIds: [],
        wearHistoryMode: 'none',
      },
      wardrobeItems: wardrobe,
      missingItems: [],
    })

    const assertion = expect(promise).rejects.toMatchObject({
      code: 'stylist_provider_timeout',
      status: 504,
      retryable: true,
    })
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion
  })

  it('retries transient provider failures once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: 'generation_failed',
                    message: 'Recovered after retry.',
                    retryable: true,
                  }),
                },
              },
            ],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ApiStylistProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'nex-agi/nex-n2-mini',
    })
    const result = await provider.generateOutfit({
      userId: 'user_1',
      locale: 'en',
      request: {
        message: 'work outfit',
        locale: 'en',
        lockedItemIds: [],
        wearHistoryMode: 'none',
      },
      wardrobeItems: wardrobe,
      missingItems: [],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.metadata.retryCount).toBe(1)
  })

  it('does not retry auth, billing, not-found, or rate-limit failures', async () => {
    for (const status of [401, 402, 403, 404, 429]) {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('{}', { status }))
      vi.stubGlobal('fetch', fetchMock)

      const provider = new ApiStylistProvider({
        apiKey: 'test-key',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelId: 'nex-agi/nex-n2-mini',
      })

      await expect(
        provider.generateOutfit({
          userId: 'user_1',
          locale: 'en',
          request: {
            message: 'work outfit',
            locale: 'en',
            lockedItemIds: [],
            wearHistoryMode: 'none',
          },
          wardrobeItems: wardrobe,
          missingItems: [],
        }),
      ).rejects.toMatchObject({ retryable: false })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      vi.unstubAllGlobals()
    }
  })

  it('prevents duplicate generation requests for the same user request', () => {
    const request = {
      message: 'work outfit',
      locale: 'en' as const,
      lockedItemIds: [],
      wearHistoryMode: 'none' as const,
    }
    const key = getStylistGenerationKey('user_1', request)

    expect(tryStartStylistGeneration(key)).toBe(true)
    expect(tryStartStylistGeneration(key)).toBe(false)
    finishStylistGeneration(key)
    expect(tryStartStylistGeneration(key)).toBe(true)
    finishStylistGeneration(key)
  })

  it('clamps stylist request timeout configuration', () => {
    vi.stubEnv('STYLIST_AI_REQUEST_TIMEOUT_MS', '1')
    expect(getStylistRequestTimeoutMs()).toBe(5000)
    vi.stubEnv('STYLIST_AI_REQUEST_TIMEOUT_MS', '999999')
    expect(getStylistRequestTimeoutMs()).toBe(45000)
  })
})

describe('outfit validation', () => {
  it('returns insufficient wardrobe for a completely empty wardrobe', () => {
    const result = validateStylistResult(
      {
        status: 'insufficient_wardrobe',
        message: 'Missing core items.',
        missingCategories: ['tops', 'bottoms', 'shoes'],
        availableCategories: [],
      },
      [],
    )

    expect(result.status).toBe('insufficient_wardrobe')
  })

  it('detects only one top as missing bottoms and shoes', () => {
    expect(findMissingCoreItems(wardrobe.slice(0, 1))).toEqual([
      'bottoms',
      'shoes',
    ])
  })

  it('detects top but no bottoms or shoes', () => {
    const topOnly = [wardrobe[0]]
    expect(hasCompleteOutfit(topOnly)).toBe(false)
    expect(findMissingCoreItems(topOnly)).toEqual(['bottoms', 'shoes'])
  })

  it('uses manual categories even when AI analysis failed', () => {
    const diagnostics = getStylistWardrobeDiagnostics([
      {
        id: '44444444-4444-4444-8444-444444444444',
        userId: 'user_1',
        name: 'Manual jeans',
        category: 'bottom',
        clothingType: 'jeans',
        colors: ['blue'],
        seasons: [],
        styles: [],
        material: '',
        brand: '',
        notes: '',
        imageUrl: '/jeans.webp',
        imageStorageKey: 'jeans.webp',
        imageContentType: 'image/webp',
        imageSize: '100',
        imageColorHints: null,
        originalImageUrl: null,
        originalImageStorageKey: null,
        originalImageContentType: null,
        originalImageSize: null,
        processedImageUrl: null,
        processedImageStorageKey: null,
        processedImageContentType: null,
        processedImageSize: null,
        backgroundRemovalStatus: 'done',
        backgroundRemovalProvider: 'mock',
        backgroundRemovalModelId: 'mock',
        imageDeletionStatus: 'active',
        imageDeleteRequestedAt: null,
        analysisStatus: 'failed',
        aiAnalysis: null,
        userCorrections: null,
        analysisError: 'failed',
        analysisPromptVersion: null,
        analysisModelId: null,
        analyzedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    expect(diagnostics.categories).toEqual({ bottoms: 1 })
    expect(diagnostics.analysisStatuses).toEqual({ failed: 1 })
  })

  it('normalizes common category and clothing type aliases', () => {
    expect(normalizeStylistCategory('top')).toBe('tops')
    expect(normalizeStylistCategory('other', 't-shirt')).toBe('tops')
    expect(normalizeStylistCategory('other', 'pants')).toBe('bottoms')
    expect(normalizeStylistCategory('shoe')).toBe('shoes')
    expect(normalizeStylistCategory('other', 'sneakers')).toBe('shoes')
  })

  it('accepts a valid complete wardrobe result', () => {
    const result = validateStylistResult(
      {
        status: 'success',
        outfit: {
          title: 'Complete outfit',
          occasion: 'work',
          items: wardrobe.map((item) => ({
            wardrobeItemId: item.id,
            role: item.category,
            explanation: 'Selected from owned wardrobe.',
          })),
          overallExplanation: 'Complete outfit.',
          confidenceScore: 0.8,
          alternativeSuggestions: [],
          missingItems: [],
        },
      },
      wardrobe,
    )

    expect(result.status).toBe('success')
  })

  it('rejects complete wardrobe success when provider returns only tops', () => {
    expect(() =>
      validateStylistResult(
        {
          status: 'success',
          outfit: {
            title: 'Only top',
            occasion: 'work',
            items: [
              {
                wardrobeItemId: wardrobe[0].id,
                role: 'tops',
                explanation: 'Selected from owned wardrobe.',
              },
            ],
            overallExplanation: 'Only a shirt.',
            confidenceScore: 0.4,
            alternativeSuggestions: [],
            missingItems: [],
          },
        },
        wardrobe,
      ),
    ).toThrow('incomplete_outfit:bottoms,shoes')
  })

  it('rejects complete wardrobe success when provider omits shoes', () => {
    expect(() =>
      validateStylistResult(
        {
          status: 'success',
          outfit: {
            title: 'No shoes',
            occasion: 'work',
            items: wardrobe.slice(0, 2).map((item) => ({
              wardrobeItemId: item.id,
              role: item.category,
              explanation: 'Selected from owned wardrobe.',
            })),
            overallExplanation: 'No shoes.',
            confidenceScore: 0.5,
            alternativeSuggestions: [],
            missingItems: ['shoes'],
          },
        },
        wardrobe,
      ),
    ).toThrow('incomplete_outfit:shoes')
  })

  it('allows explicit single-item recommendations', () => {
    const request = {
      message: 'choose shoes',
      locale: 'en' as const,
      lockedItemIds: [],
      wearHistoryMode: 'none' as const,
    }

    expect(isSingleItemStylistRequest(request)).toBe(true)
    expect(getRequiredCategoriesForStylistRequest(request)).toEqual([])

    const result = validateStylistResult(
      {
        status: 'success',
        outfit: {
          title: 'Shoes',
          occasion: 'single item',
          items: [
            {
              wardrobeItemId: wardrobe[2].id,
              role: 'shoes',
              explanation: 'Selected from owned wardrobe.',
            },
          ],
          overallExplanation: 'These shoes work best.',
          confidenceScore: 0.75,
          alternativeSuggestions: [],
          missingItems: [],
        },
      },
      wardrobe,
      { requiredCategories: getRequiredCategoriesForStylistRequest(request) },
    )

    expect(result.status).toBe('success')
  })

  it('rejects provider success with empty items without leaking Zod errors', () => {
    expect(() =>
      validateStylistResult(
        {
          status: 'success',
          outfit: {
            title: 'Empty outfit',
            occasion: 'work',
            items: [],
            overallExplanation: 'Nothing selected.',
            confidenceScore: 0.1,
            alternativeSuggestions: [],
            missingItems: [],
          },
        },
        wardrobe,
      ),
    ).toThrow('invalid_stylist_result')
  })

  it('prevents hallucinated clothing ids', () => {
    expect(() =>
      validateStylistOutfit(
        {
          title: 'Bad outfit',
          occasion: 'work',
          items: [
            {
              wardrobeItemId: '99999999-9999-4999-8999-999999999999',
              role: 'top',
              explanation: 'Not owned.',
            },
          ],
          overallExplanation: 'Uses an item outside the wardrobe.',
          confidenceScore: 0.2,
          alternativeSuggestions: [],
          missingItems: [],
        },
        wardrobe,
      ),
    ).toThrow('hallucinated_items')
  })

  it('prevents hallucinated clothing ids in result validation', () => {
    expect(() =>
      validateStylistResult(
        {
          status: 'success',
          outfit: {
            title: 'Bad outfit',
            occasion: 'work',
            items: [
              {
                wardrobeItemId: '99999999-9999-4999-8999-999999999999',
                role: 'top',
                explanation: 'Not owned.',
              },
            ],
            overallExplanation: 'Uses an item outside the wardrobe.',
            confidenceScore: 0.2,
            alternativeSuggestions: [],
            missingItems: [],
          },
        },
        wardrobe,
      ),
    ).toThrow('hallucinated_items')
  })

  it('rejects malformed provider responses through a controlled error', () => {
    expect(() => validateStylistResult({ nope: true }, wardrobe)).toThrow(
      'invalid_stylist_result',
    )
  })

  it('keeps localized insufficient wardrobe messages valid', () => {
    const result = validateStylistResult(
      {
        status: 'insufficient_wardrobe',
        message: 'Для праздничного образа не хватает низа и обуви.',
        missingCategories: ['bottoms', 'shoes'],
        availableCategories: ['tops'],
      },
      wardrobe.slice(0, 1),
    )

    expect(result).toMatchObject({
      status: 'insufficient_wardrobe',
      missingCategories: ['bottoms', 'shoes'],
      availableCategories: ['tops'],
    })
  })

  it('requires complete outfits unless missing pieces are declared', () => {
    expect(hasCompleteOutfit(wardrobe)).toBe(true)
    expect(findMissingCoreItems(wardrobe.slice(0, 2))).toEqual(['shoes'])
    expect(() =>
      validateStylistOutfit(
        {
          title: 'Incomplete',
          occasion: 'work',
          items: wardrobe.slice(0, 2).map((item) => ({
            wardrobeItemId: item.id,
            role: item.category,
            explanation: 'Selected from owned wardrobe.',
          })),
          overallExplanation: 'No shoes included.',
          confidenceScore: 0.4,
          alternativeSuggestions: [],
          missingItems: [],
        },
        wardrobe,
      ),
    ).toThrow('incomplete_outfit')
  })

  it('does not allow incomplete success even when missing items are explicit', () => {
    expect(() =>
      validateStylistOutfit(
        {
          title: 'Needs shoes',
          occasion: 'work',
          items: wardrobe.slice(0, 2).map((item) => ({
            wardrobeItemId: item.id,
            role: item.category,
            explanation: 'Selected from owned wardrobe.',
          })),
          overallExplanation: 'This needs shoes.',
          confidenceScore: 0.4,
          alternativeSuggestions: [],
          missingItems: ['shoes'],
        },
        wardrobe,
      ),
    ).toThrow('incomplete_outfit:shoes')
  })
})

describe('batch outfit validation', () => {
  it('normalizes a production provider batch success shape', () => {
    const normalized = normalizeStylistProviderOutput({
      status: 'success',
      candidates: [
        {
          title: 'Work outfit',
          description: 'A clean complete work outfit.',
          styleDirection: 'business',
          occasion: null,
          season: null,
          formality: null,
          confidence: 0.86,
          items: [
            { wardrobeItemId: wardrobe[0].id, role: 'tops' },
            { wardrobeItemId: wardrobe[1].id, role: 'bottoms' },
            { wardrobeItemId: wardrobe[2].id, role: 'shoes' },
          ],
        },
      ],
    })

    const result = validateStylistBatchResult(normalized, wardrobe)

    expect(result.status).toBe('success')
  })

  it('wraps a single unambiguous candidate object', () => {
    const normalized = normalizeStylistProviderOutput({
      status: 'success',
      candidate: {
        title: 'Single candidate',
        description: 'A complete outfit.',
        styleDirection: 'minimal',
        occasion: null,
        season: null,
        formality: null,
        confidence: 0.8,
        items: [
          { wardrobeItemId: wardrobe[0].id, role: 'tops' },
          { wardrobeItemId: wardrobe[1].id, role: 'bottoms' },
          { wardrobeItemId: wardrobe[2].id, role: 'shoes' },
        ],
      },
    })

    const result = validateStylistBatchResult(normalized, wardrobe)

    expect(result.status).toBe('success')
  })

  it('normalizes safe role aliases and string confidence', () => {
    const normalized = normalizeStylistProviderOutput({
      status: 'success',
      candidates: [
        {
          title: 'Alias outfit',
          description: 'A complete outfit.',
          styleDirection: 'casual',
          occasion: null,
          season: null,
          formality: null,
          confidence: '0.77',
          items: [
            { wardrobeItemId: wardrobe[0].id, role: 'top' },
            { wardrobeItemId: wardrobe[1].id, role: 'bottom' },
            { wardrobeItemId: wardrobe[2].id, role: 'shoe' },
          ],
        },
      ],
    })

    const result = validateStylistBatchResult(normalized, wardrobe)
    if (result.status !== 'success') throw new Error('expected success')

    expect(result.candidates[0].confidenceScore).toBe(0.77)
    expect(result.candidates[0].items.map((item) => item.role)).toEqual([
      'tops',
      'bottoms',
      'shoes',
    ])
  })

  it('converts a legacy single-outfit response when intent is clear', () => {
    const normalized = normalizeStylistProviderOutput({
      status: 'success',
      outfit: {
        title: 'Legacy outfit',
        description: 'Converted safely.',
        styleDirection: 'classic',
        occasion: null,
        season: null,
        formality: null,
        confidence: 0.7,
        items: [
          { wardrobeItemId: wardrobe[0].id, role: 'tops' },
          { wardrobeItemId: wardrobe[1].id, role: 'bottoms' },
          { wardrobeItemId: wardrobe[2].id, role: 'shoes' },
        ],
      },
    })

    const result = validateStylistBatchResult(normalized, wardrobe)

    expect(result.status).toBe('success')
  })

  it('parses markdown code-fenced JSON', () => {
    const parsed = parseProviderJson(`\`\`\`json
{"status":"generation_failed","message":"No stable outfit.","retryable":true}
\`\`\``)

    expect(parsed).toMatchObject({
      status: 'generation_failed',
      retryable: true,
    })
  })

  it('rejects malformed JSON', () => {
    expect(() => parseProviderJson('```json\n{bad json}\n```')).toThrow()
  })

  it('rejects empty success candidates', () => {
    expect(() =>
      validateStylistBatchResult(
        normalizeStylistProviderOutput({
          status: 'success',
          candidates: [],
        }),
        wardrobe,
      ),
    ).toThrow('invalid_stylist_batch_result')
  })

  it('rejects missing items', () => {
    expect(() =>
      validateStylistBatchResult(
        normalizeStylistProviderOutput({
          status: 'success',
          candidates: [
            {
              title: 'Missing items',
              description: 'No items.',
              styleDirection: 'minimal',
              occasion: null,
              season: null,
              formality: null,
              confidence: 0.5,
            },
          ],
        }),
        wardrobe,
      ),
    ).toThrow('invalid_stylist_batch_result')
  })

  it('rejects unsupported roles', () => {
    expect(() =>
      validateStylistBatchResult(
        normalizeStylistProviderOutput({
          status: 'success',
          candidates: [
            {
              title: 'Unsupported role',
              description: 'Uses an unsupported role.',
              styleDirection: 'minimal',
              occasion: null,
              season: null,
              formality: null,
              confidence: 0.5,
              items: [
                { wardrobeItemId: wardrobe[0].id, role: 'hat' },
                { wardrobeItemId: wardrobe[1].id, role: 'bottoms' },
                { wardrobeItemId: wardrobe[2].id, role: 'shoes' },
              ],
            },
          ],
        }),
        wardrobe,
      ),
    ).toThrow('unsupported_roles')
  })

  it('validates three owned candidates', () => {
    const result = validateStylistBatchResult(
      {
        status: 'success',
        candidates: [
          batchCandidate,
          {
            ...batchCandidate,
            title: 'Candidate 2',
            styleDirection: 'relaxed',
            items: [
              {
                wardrobeItemId: '44444444-4444-4444-8444-444444444444',
                role: 'tops',
                explanation: 'Uses blue oxford.',
              },
              batchCandidate.items[1],
              batchCandidate.items[2],
            ],
          },
          {
            ...batchCandidate,
            title: 'Candidate 3',
            styleDirection: 'elevated',
            items: [
              batchCandidate.items[0],
              {
                wardrobeItemId: '55555555-5555-4555-8555-555555555555',
                role: 'bottoms',
                explanation: 'Uses grey chinos.',
              },
              {
                wardrobeItemId: '66666666-6666-4666-8666-666666666666',
                role: 'shoes',
                explanation: 'Uses black loafers.',
              },
            ],
          },
        ],
      },
      extraWardrobe,
    )

    expect(result.status).toBe('success')
    if (result.status !== 'success') throw new Error('expected success')
    expect(result.candidates.length).toBe(3)
  })

  it('rejects hallucinated ids in batch candidates', () => {
    expect(() =>
      validateStylistBatchResult(
        {
          status: 'success',
          candidates: [
            {
              ...batchCandidate,
              items: [
                ...batchCandidate.items,
                {
                  wardrobeItemId: '99999999-9999-4999-8999-999999999999',
                  role: 'tops',
                  explanation: 'Fake item.',
                },
              ],
            },
          ],
        },
        wardrobe,
      ),
    ).toThrow(/hallucinated_items/)
  })

  it('rejects candidates that omit locked items', () => {
    expect(() =>
      validateStylistBatchResult(
        {
          status: 'success',
          candidates: [
            {
              ...batchCandidate,
              items: batchCandidate.items.filter(
                (item) =>
                  item.wardrobeItemId !==
                  '11111111-1111-4111-8111-111111111111',
              ),
            },
          ],
        },
        wardrobe,
        {
          requiredCategories: ['bottoms', 'shoes'],
          lockedItemIds: ['11111111-1111-4111-8111-111111111111'],
        },
      ),
    ).toThrow(/missing_locked_items/)
  })

  it('filters duplicate candidates by exact item set and style', () => {
    const filtered = filterDiverseCandidates([batchCandidate, batchCandidate])

    expect(filtered.length).toBe(1)
  })

  it('measures excessive overlap', () => {
    expect(getCandidateOverlap(batchCandidate, batchCandidate)).toBe(1)
  })
})

describe('stylist generation diagnostics', () => {
  const details = {
    requiredCategories: ['tops', 'bottoms', 'shoes', 'tops'],
    availableCategories: ['tops', 'bottoms', 'shoes'],
    missingCategories: ['shoes'],
    lockedItemIds: [wardrobe[0].id],
    eligibleItemCount: 3,
  }

  it('builds the required diagnostics shape for generation_failed 422 branches', () => {
    const payload = createStylistGenerateFailurePayload({
      status: 'generation_failed',
      code: 'stylist_generation_failed',
      message: 'Provider could not create a valid outfit.',
      details,
      retryable: true,
    })

    expect(payload).toEqual({
      status: 'generation_failed',
      code: 'stylist_generation_failed',
      message: 'Provider could not create a valid outfit.',
      retryable: true,
      details: {
        requiredCategories: ['tops', 'bottoms', 'shoes'],
        availableCategories: ['tops', 'bottoms', 'shoes'],
        missingCategories: ['shoes'],
        lockedItemIds: [wardrobe[0].id],
        eligibleItemCount: 3,
      },
    })
  })

  it('builds the required diagnostics shape for insufficient_wardrobe 422 branches', () => {
    const payload = createStylistGenerateFailurePayload({
      status: 'insufficient_wardrobe',
      code: 'insufficient_wardrobe',
      message: 'Missing shoes.',
      details,
    })

    expect(payload.status).toBe('insufficient_wardrobe')
    expect(payload.code).toBe('insufficient_wardrobe')
    expect(payload.details.missingCategories).toEqual(['shoes'])
    expect(payload.details.eligibleItemCount).toBe(3)
  })

  it('keeps all unprocessable stylist branches structured with diagnostics', () => {
    const unprocessableCodes = [
      'locked_item_unavailable',
      'stylist_generation_failed',
      'stylist_model_json_unsupported',
    ]

    for (const code of unprocessableCodes) {
      expect(
        createStylistGenerateFailurePayload({
          status: 'generation_failed',
          code,
          message: 'Unprocessable stylist generation.',
          details,
          retryable: code !== 'locked_item_unavailable',
        }),
      ).toMatchObject({
        status: 'generation_failed',
        code,
        message: 'Unprocessable stylist generation.',
        details: {
          requiredCategories: ['tops', 'bottoms', 'shoes'],
          availableCategories: ['tops', 'bottoms', 'shoes'],
          missingCategories: ['shoes'],
          lockedItemIds: [wardrobe[0].id],
          eligibleItemCount: 3,
        },
      })
    }
  })

  it('normalizes empty or invalid diagnostic detail values safely', () => {
    expect(
      buildStylistGenerateFailureDetails({
        requiredCategories: ['tops', '', 'tops'],
        availableCategories: ['bottoms'],
        missingCategories: [],
        lockedItemIds: ['  ', wardrobe[1].id],
        eligibleItemCount: Number.NaN,
      }),
    ).toEqual({
      requiredCategories: ['tops'],
      availableCategories: ['bottoms'],
      missingCategories: [],
      lockedItemIds: [wardrobe[1].id],
      eligibleItemCount: 0,
    })
  })

  it('labels duplicate and custom request diagnostics without private prompt text', () => {
    expect(
      getStylistRequestType({ quickRequest: 'work', message: 'private' }),
    ).toBe('work')
    expect(getStylistRequestType({ message: 'private request' })).toBe('custom')
    expect(getStylistRequestType(null)).toBe('unknown')
  })
})
