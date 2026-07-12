import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clothingAnalysisSchema,
  type ClothingAnalysis,
  mergeAnalysisCorrections,
  parseAnalysisCorrections,
} from '@/lib/ai/analysis-schema'
import { getClothingAnalysisProvider } from '@/lib/ai'
import {
  OpenAICompatibleClothingAnalysisProvider,
  openRouterDiagnostics,
} from '@/lib/ai/openai-compatible-provider'
import { enhanceClothingAnalysis } from '@/lib/ai/quality'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AI clothing analysis validation', () => {
  it('accepts a complete normalized analysis result', () => {
    const result = clothingAnalysisSchema.parse({
      detectedClothingType: 'shirt',
      detectedCategory: 'tops',
      colors: ['black'],
      dominantHexColors: ['#ABCDEF'],
      material: 'cotton',
      season: ['spring'],
      style: ['casual'],
      fit: 'regular',
      pattern: 'solid',
      warmthLevel: 2,
      formalityLevel: 3,
      brandGuess: '',
      confidenceScore: 0.8,
      visualDescription: 'A black cotton shirt.',
      promptVersion: 'clothing-analysis-v1',
      modelId: 'mock',
    })

    expect(result.dominantHexColors).toEqual(['#abcdef'])
    expect(result.fieldConfidences).toEqual({})
    expect(result.needsReviewFields).toEqual([])
  })

  it('rejects invalid confidence scores', () => {
    expect(() =>
      clothingAnalysisSchema.parse({
        detectedClothingType: 'shirt',
        detectedCategory: 'tops',
        colors: ['black'],
        dominantHexColors: ['#000000'],
        material: 'cotton',
        season: ['spring'],
        style: ['casual'],
        fit: 'regular',
        pattern: 'solid',
        warmthLevel: 2,
        formalityLevel: 3,
        brandGuess: '',
        confidenceScore: 2,
        visualDescription: 'A black cotton shirt.',
        promptVersion: 'clothing-analysis-v1',
        modelId: 'mock',
      }),
    ).toThrow()
  })

  it('merges user corrections over raw AI values', () => {
    const analysis = clothingAnalysisSchema.parse({
      detectedClothingType: 'shirt',
      detectedCategory: 'tops',
      colors: ['black'],
      dominantHexColors: ['#000000'],
      material: 'cotton',
      season: ['spring'],
      style: ['casual'],
      fit: 'regular',
      pattern: 'solid',
      warmthLevel: 2,
      formalityLevel: 3,
      brandGuess: '',
      confidenceScore: 0.8,
      visualDescription: 'A shirt.',
      promptVersion: 'clothing-analysis-v1',
      modelId: 'mock',
    })
    const corrections = parseAnalysisCorrections({
      material: 'linen',
      warmthLevel: 1,
    })

    expect(mergeAnalysisCorrections(analysis, corrections)).toMatchObject({
      material: 'linen',
      warmthLevel: 1,
      detectedClothingType: 'shirt',
    })
  })
})

describe('AI provider behavior', () => {
  it('uses the mock provider in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('AI_PROVIDER', 'mock')

    const result = await getClothingAnalysisProvider().analyzeClothing({
      itemId: 'item_1',
      userId: 'user_1',
      imageUrl: '/uploads/test.webp',
      name: 'Oxford shirt',
      category: 'tops',
      clothingType: 'shirt',
    })

    expect(result.modelId).toBe('mock-clothing-vision-v1')
  })

  it('blocks the mock provider in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AI_PROVIDER', 'mock')

    expect(() => getClothingAnalysisProvider()).toThrow(
      'Mock AI provider is not allowed in production',
    )
  })

  it('requires credentials for the real provider', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('AI_PROVIDER', 'openai-compatible')
    vi.stubEnv('AI_API_KEY', '')

    expect(() => getClothingAnalysisProvider()).toThrow(
      'Real AI provider is missing required environment variables',
    )
  })

  it('normalizes OpenRouter request URL and headers', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    const headers = openRouterDiagnostics.getHeaders('secret-key')

    expect(
      openRouterDiagnostics.toCompletionsUrl('https://openrouter.ai/api/v1'),
    ).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(headers.Authorization).toBe('Bearer secret-key')
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['HTTP-Referer']).toBe('http://localhost:3000')
    expect(headers['X-OpenRouter-Title']).toBe('Vestra')
  })

  it('maps OpenRouter HTTP failures with status details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 'invalid_api_key',
              message: 'No auth credentials found',
              metadata: { provider_name: 'OpenRouter' },
              type: 'authentication_error',
            },
          }),
          { status: 401 },
        )
      }),
    )

    const provider = new OpenAICompatibleClothingAnalysisProvider({
      apiKey: 'secret-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'openrouter/test-model',
    })

    await expect(
      provider.analyzeClothing({
        itemId: 'item_1',
        userId: 'user_1',
        imageUrl: 'https://example.com/image.webp',
        imageDataUrl: 'data:image/webp;base64,abc',
        name: 'Grey tee',
        category: 'tops',
        clothingType: 't-shirt',
      }),
    ).rejects.toMatchObject({
      detail: {
        status: 401,
        code: 'ai_provider_invalid_api_key',
        message: 'No auth credentials found',
        metadata: { provider_name: 'OpenRouter' },
        errorType: 'authentication_error',
      },
    })
  })

  it('does not send localhost image URLs to OpenRouter', async () => {
    const provider = new OpenAICompatibleClothingAnalysisProvider({
      apiKey: 'secret-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'openrouter/test-model',
    })

    await expect(
      provider.analyzeClothing({
        itemId: 'item_1',
        userId: 'user_1',
        imageUrl: 'http://localhost:3000/uploads/item.webp',
        name: 'Grey tee',
        category: 'tops',
        clothingType: 't-shirt',
      }),
    ).rejects.toThrow('ai_provider_local_image_data_url_missing')
  })

  it('falls back to json_object when strict json_schema is rejected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const calls: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        calls.push(JSON.parse(String((init as RequestInit).body)))
        if (calls.length === 1) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'bad_request',
                message: 'response_format json_schema is not supported',
              },
            }),
            { status: 400 },
          )
        }

        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  detectedClothingType: 't-shirt',
                  detectedCategory: 'tops',
                  colors: ['grey'],
                  dominantHexColors: ['#888888'],
                  material: 'cotton',
                  season: ['spring'],
                  style: ['casual'],
                  fit: 'regular',
                  pattern: 'solid',
                  warmthLevel: 1,
                  formalityLevel: 1,
                  brandGuess: '',
                  confidenceScore: 0.8,
                  fieldConfidences: {},
                  needsReviewFields: [],
                  visualDescription: 'A grey t-shirt.',
                  promptVersion: 'clothing-analysis-v2',
                  modelId: 'openrouter/test-model',
                }),
              },
            },
          ],
        })
      }),
    )

    const provider = new OpenAICompatibleClothingAnalysisProvider({
      apiKey: 'secret-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'openrouter/test-model',
    })

    const result = await provider.analyzeClothing({
      itemId: 'item_1',
      userId: 'user_1',
      imageUrl: 'https://example.com/image.webp',
      imageDataUrl: 'data:image/webp;base64,abc',
      name: 'Grey tee',
      category: 'tops',
      clothingType: 't-shirt',
    })

    expect(result.detectedClothingType).toBe('t-shirt')
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      response_format: { type: 'json_schema' },
    })
    expect(calls[1]).toMatchObject({
      response_format: { type: 'json_object' },
    })
  })
})

describe('AI analysis quality enhancement', () => {
  const baseAnalysis: ClothingAnalysis = clothingAnalysisSchema.parse({
    detectedClothingType: 'item',
    detectedCategory: 'other',
    colors: ['black', 'white'],
    dominantHexColors: ['#111111', '#ffffff'],
    material: '',
    season: ['spring'],
    style: ['casual'],
    fit: 'regular',
    pattern: 'solid',
    warmthLevel: 1,
    formalityLevel: 2,
    brandGuess: '',
    confidenceScore: 0.52,
    visualDescription: 'A grey Levi’s logo t-shirt.',
    promptVersion: 'clothing-analysis-v1',
    modelId: 'vision-model',
  })

  it('uses deterministic image hints and visible text signals', () => {
    const result = enhanceClothingAnalysis(baseAnalysis, {
      itemId: 'item_1',
      userId: 'user_1',
      imageUrl: '/uploads/test.webp',
      name: "Grey Levi's t-shirt",
      category: 'other',
      clothingType: 'pending',
      colors: [],
      imageColorHints: {
        colors: ['light grey', 'grey'],
        dominantHexColors: ['#b8b8b8', '#8f8f8f'],
      },
    })

    expect(result.detectedClothingType).toBe('t-shirt')
    expect(result.detectedCategory).toBe('tops')
    expect(result.colors).toEqual(['light grey', 'grey'])
    expect(result.dominantHexColors).toEqual(['#b8b8b8', '#8f8f8f'])
    expect(result.brandGuess).toBe("Levi's")
    expect(result.material).toBe('cotton blend')
    expect(result.fieldConfidences.colors).toBeGreaterThan(0.8)
    expect(result.needsReviewFields).toContain('fit')
  })
})
