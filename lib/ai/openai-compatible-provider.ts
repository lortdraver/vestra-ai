import { clothingAnalysisSchema } from './analysis-schema'
import type { ClothingAnalysisProvider } from './provider'
import {
  wardrobeColorFamilies,
  wardrobeFormalityValues,
  wardrobeSeasons,
  wardrobeStoredRoles,
  wardrobeStoredSubtypes,
  wardrobeStyleTags,
} from '@/lib/wardrobe/taxonomy'

type OpenRouterErrorBody = {
  error?: {
    code?: string
    message?: string
    metadata?: unknown
    type?: string
  }
}

type ProviderErrorDetail = {
  status: number
  code: string
  message: string
  metadata?: unknown
  errorType?: string
  durationMs?: number
}

export type ClothingAnalysisProviderTiming = {
  providerDurationMs: number
  openRouterDurationMs: number
  responseParsingMs: number
  zodValidationMs: number
  fallbackUsed: boolean
  requestCount: number
}

export type ClothingAnalysisWithTiming = Awaited<
  ReturnType<ClothingAnalysisProvider['analyzeClothing']>
> & {
  __timing?: ClothingAnalysisProviderTiming
}

export class AiProviderHttpError extends Error {
  constructor(
    message: string,
    readonly detail: ProviderErrorDetail,
  ) {
    super(message)
    this.name = 'AiProviderHttpError'
  }
}

const statusCodeMap: Record<number, string> = {
  400: 'ai_provider_invalid_request',
  401: 'ai_provider_invalid_api_key',
  402: 'ai_provider_insufficient_credits',
  403: 'ai_provider_forbidden',
  404: 'ai_provider_not_found',
  408: 'ai_provider_timeout',
  429: 'ai_provider_rate_limited',
  502: 'ai_provider_unavailable',
  503: 'ai_provider_unavailable',
}

const responseJsonSchema = {
  name: 'vestra_clothing_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'role',
      'subtype',
      'colors',
      'colorFamilies',
      'dominantHexColors',
      'material',
      'season',
      'styleTags',
      'fit',
      'pattern',
      'warmthLevel',
      'formality',
      'formalityLevel',
      'brandGuess',
      'confidenceScore',
      'fieldConfidences',
      'needsReviewFields',
      'visualDescription',
      'promptVersion',
      'modelId',
    ],
    properties: {
      role: {
        type: 'string',
        enum: [...wardrobeStoredRoles],
      },
      subtype: { type: 'string', enum: [...wardrobeStoredSubtypes] },
      colors: { type: 'array', items: { type: 'string' } },
      colorFamilies: {
        type: 'array',
        items: { type: 'string', enum: [...wardrobeColorFamilies] },
      },
      dominantHexColors: {
        type: 'array',
        items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      },
      material: { type: 'string' },
      season: {
        type: 'array',
        items: { type: 'string', enum: [...wardrobeSeasons] },
      },
      styleTags: {
        type: 'array',
        items: { type: 'string', enum: [...wardrobeStyleTags] },
      },
      fit: { type: 'string' },
      pattern: { type: 'string' },
      warmthLevel: { type: 'integer', minimum: 1, maximum: 5 },
      formality: { type: 'string', enum: [...wardrobeFormalityValues] },
      formalityLevel: { type: 'integer', minimum: 1, maximum: 5 },
      brandGuess: { type: 'string' },
      confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
      fieldConfidences: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'number', minimum: 0, maximum: 1 },
          subtype: { type: 'number', minimum: 0, maximum: 1 },
          colors: { type: 'number', minimum: 0, maximum: 1 },
          colorFamilies: { type: 'number', minimum: 0, maximum: 1 },
          dominantHexColors: { type: 'number', minimum: 0, maximum: 1 },
          material: { type: 'number', minimum: 0, maximum: 1 },
          season: { type: 'number', minimum: 0, maximum: 1 },
          styleTags: { type: 'number', minimum: 0, maximum: 1 },
          fit: { type: 'number', minimum: 0, maximum: 1 },
          pattern: { type: 'number', minimum: 0, maximum: 1 },
          warmthLevel: { type: 'number', minimum: 0, maximum: 1 },
          formality: { type: 'number', minimum: 0, maximum: 1 },
          formalityLevel: { type: 'number', minimum: 0, maximum: 1 },
          brandGuess: { type: 'number', minimum: 0, maximum: 1 },
          visualDescription: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      needsReviewFields: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'role',
            'subtype',
            'colors',
            'colorFamilies',
            'dominantHexColors',
            'material',
            'season',
            'styleTags',
            'fit',
            'pattern',
            'warmthLevel',
            'formality',
            'formalityLevel',
            'brandGuess',
            'visualDescription',
          ],
        },
      },
      visualDescription: { type: 'string' },
      promptVersion: { type: 'string' },
      modelId: { type: 'string' },
    },
  },
}

function toCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions')
    ? trimmed
    : `${trimmed}/chat/completions`
}

function isLocalImageReference(url: string) {
  return (
    url.startsWith('/') ||
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1') ||
    /^http:\/\/192\.168\./.test(url) ||
    /^http:\/\/10\./.test(url) ||
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\./.test(url)
  )
}

function shouldFallbackToJsonObject(status: number, body: OpenRouterErrorBody) {
  const text = `${body.error?.code ?? ''} ${body.error?.message ?? ''} ${
    body.error?.type ?? ''
  }`.toLowerCase()

  return (
    status === 400 &&
    (text.includes('response_format') ||
      text.includes('json_schema') ||
      text.includes('schema') ||
      text.includes('structured'))
  )
}

function mapStatusToCode(status: number) {
  return statusCodeMap[status] ?? 'ai_provider_request_failed'
}

async function readErrorBody(response: Response): Promise<OpenRouterErrorBody> {
  const text = await response.text().catch(() => '')
  if (!text) return {}

  try {
    return JSON.parse(text) as OpenRouterErrorBody
  } catch {
    return { error: { message: text.slice(0, 500) } }
  }
}

function logDevelopmentProviderError(input: {
  status: number
  code: string
  message: string
  metadata?: unknown
  errorType?: string
  modelId: string
  requestUrl: string
  fallback?: string
  durationMs?: number
}) {
  if (process.env.NODE_ENV !== 'development') return

  console.error('OpenRouter clothing analysis request failed', {
    status: input.status,
    code: input.code,
    message: input.message,
    metadata: input.metadata,
    errorType: input.errorType,
    modelId: input.modelId,
    requestUrl: input.requestUrl,
    fallback: input.fallback,
    durationMs: input.durationMs,
  })
}

function logDevelopmentProviderRequest(input: {
  status: number
  modelId: string
  requestUrl: string
  responseFormat: 'json_schema' | 'json_object'
  durationMs: number
}) {
  if (process.env.NODE_ENV !== 'development') return

  console.log('[dev] OpenRouter clothing analysis request completed', input)
}

function getOpenRouterReferer() {
  return process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:3000'
}

function getHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': getOpenRouterReferer(),
    'X-OpenRouter-Title': 'Vestra',
  }
}

export class OpenAICompatibleClothingAnalysisProvider implements ClothingAnalysisProvider {
  constructor(
    private readonly config: {
      apiKey: string
      baseUrl: string
      modelId: string
    },
  ) {}

  private buildRequestBody(
    input: Parameters<ClothingAnalysisProvider['analyzeClothing']>[0],
    responseFormat: 'json_schema' | 'json_object',
  ) {
    const imageReference = input.imageDataUrl ?? input.imageUrl

    if (isLocalImageReference(imageReference)) {
      throw new Error('ai_provider_local_image_data_url_missing')
    }

    return {
      model: this.config.modelId,
      response_format:
        responseFormat === 'json_schema'
          ? { type: 'json_schema', json_schema: responseJsonSchema }
          : { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a precise clothing vision system for a virtual wardrobe. Analyze the garment, not the background. Prefer the visible garment color over background color. Detect logos or brand text only when clearly visible. Return strict JSON only with: role, subtype, colors, colorFamilies, dominantHexColors, material, season, styleTags, fit, pattern, warmthLevel, formality, formalityLevel, brandGuess, confidenceScore, fieldConfidences, needsReviewFields, visualDescription, promptVersion, modelId. role must be one of top, bottom, outerwear, one_piece, shoes, accessory, unresolved. subtype must use the supplied enum. colorFamilies must use normalized families such as gray, navy, blue, beige, brown, and burgundy. styleTags must use the supplied enum only. formality must be one of relaxed, casual, smart_casual, business, formal. Do not infer a brand unless it is visible and confident. fieldConfidences must be 0-1 per field, and needsReviewFields must include every field below 0.6 confidence.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this wardrobe item. Manual name: ${input.name}. Manual role hint: ${input.category}. Manual subtype hint: ${input.clothingType}. Deterministic browser color hints: colors=${(input.imageColorHints?.colors ?? input.colors ?? []).join(', ') || 'none'}, dominantHexColors=${(input.imageColorHints?.dominantHexColors ?? []).join(', ') || 'none'}. Example expectations: a gray Levi's tee should return role=top, subtype=t_shirt, colorFamilies including gray, casual styleTags, spring/summer/autumn season, low formality, and Levi's only if the logo is visible. Blue Nike shorts should return role=bottom, subtype=shorts. A light blue polo should return role=top, subtype=polo. A button-up Oxford shirt should return role=top, subtype=shirt.`,
            },
            {
              type: 'image_url',
              image_url: { url: imageReference },
            },
          ],
        },
      ],
    }
  }

  private async requestAnalysis(
    input: Parameters<ClothingAnalysisProvider['analyzeClothing']>[0],
    responseFormat: 'json_schema' | 'json_object',
  ) {
    const requestUrl = toCompletionsUrl(this.config.baseUrl)
    const requestStartedAt = performance.now()
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: getHeaders(this.config.apiKey),
      body: JSON.stringify(this.buildRequestBody(input, responseFormat)),
    })
    const durationMs = Math.round(performance.now() - requestStartedAt)

    if (!response.ok) {
      const body = await readErrorBody(response)
      const code = mapStatusToCode(response.status)
      const message =
        body.error?.message ||
        `OpenRouter request failed with HTTP ${response.status}`

      logDevelopmentProviderError({
        status: response.status,
        code: body.error?.code || code,
        message,
        metadata: body.error?.metadata,
        errorType: body.error?.type,
        modelId: this.config.modelId,
        requestUrl,
        durationMs,
      })

      throw new AiProviderHttpError(code, {
        status: response.status,
        code,
        message,
        metadata: body.error?.metadata,
        errorType: body.error?.type,
        durationMs,
      })
    }

    logDevelopmentProviderRequest({
      status: response.status,
      modelId: this.config.modelId,
      requestUrl,
      responseFormat,
      durationMs,
    })

    return { response, durationMs }
  }

  async analyzeClothing(
    input: Parameters<ClothingAnalysisProvider['analyzeClothing']>[0],
  ) {
    const providerStartedAt = performance.now()
    let response: Response
    let openRouterDurationMs = 0
    let requestCount = 0
    let fallbackUsed = false

    try {
      const result = await this.requestAnalysis(input, 'json_schema')
      response = result.response
      openRouterDurationMs += result.durationMs
      requestCount += 1
    } catch (error) {
      if (
        error instanceof AiProviderHttpError &&
        shouldFallbackToJsonObject(error.detail.status, {
          error: {
            code: error.detail.code,
            message: error.detail.message,
            type: error.detail.errorType,
          },
        })
      ) {
        logDevelopmentProviderError({
          status: error.detail.status,
          code: error.detail.code,
          message:
            'OpenRouter rejected strict json_schema response_format. Retrying with json_object; Zod validation remains enforced.',
          metadata: error.detail.metadata,
          errorType: error.detail.errorType,
          modelId: this.config.modelId,
          requestUrl: toCompletionsUrl(this.config.baseUrl),
          fallback: 'json_object',
          durationMs: error.detail.durationMs,
        })
        fallbackUsed = true
        openRouterDurationMs += error.detail.durationMs ?? 0
        requestCount += 1
        const result = await this.requestAnalysis(input, 'json_object')
        response = result.response
        openRouterDurationMs += result.durationMs
        requestCount += 1
      } else {
        throw error
      }
    }

    const responseParsingStartedAt = performance.now()
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('ai_provider_empty_response')
    }
    const parsedContent = JSON.parse(content)
    const responseParsingMs = Math.round(
      performance.now() - responseParsingStartedAt,
    )

    const validationStartedAt = performance.now()
    const analysis = clothingAnalysisSchema.parse(parsedContent)
    const zodValidationMs = Math.round(performance.now() - validationStartedAt)

    Object.defineProperty(analysis, '__timing', {
      enumerable: false,
      value: {
        providerDurationMs: Math.round(performance.now() - providerStartedAt),
        openRouterDurationMs,
        responseParsingMs,
        zodValidationMs,
        fallbackUsed,
        requestCount,
      } satisfies ClothingAnalysisProviderTiming,
    })

    return analysis
  }
}

export const openRouterDiagnostics = {
  toCompletionsUrl,
  getHeaders,
  mapStatusToCode,
  readErrorBody,
}
