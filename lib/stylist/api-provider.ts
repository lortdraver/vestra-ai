import type { StylistProvider, StylistProviderInput } from './types'
import {
  parseProviderJson,
  type StylistProviderEnvelope,
} from './provider-output'

export type ApiStylistProviderConfig = {
  apiKey: string
  baseUrl: string
  modelId: string
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

type ResponseFormatMode = 'json_schema' | 'json_object'

type ModelCapability = {
  supportsJsonSchema: boolean
  supportsJsonObject: boolean
  timeoutMs?: number
}

type ProviderRequestResult =
  | {
      ok: true
      httpStatus: number
      output: unknown
      elapsedMs: number
      aborted: false
    }
  | {
      ok: false
      httpStatus: number
      output: null
      elapsedMs: number
      aborted: boolean
    }

export class StylistProviderRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly detail: {
      httpStatus?: number
      elapsedMs?: number
      timeoutMs?: number
      responseFormatMode?: ResponseFormatMode
      requestCount?: number
      aborted?: boolean
    } = {},
  ) {
    super(message)
    this.name = 'StylistProviderRequestError'
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000
const MIN_REQUEST_TIMEOUT_MS = 5_000
const MAX_REQUEST_TIMEOUT_MS = 45_000

const modelCapabilities: Record<string, ModelCapability> = {
  'nex-agi/nex-n2-mini': {
    supportsJsonSchema: false,
    supportsJsonObject: true,
  },
}

const responseJsonSchema = {
  name: 'vestra_stylist_batch',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['status'],
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['status', 'candidates'],
        properties: {
          status: { const: 'success' },
          candidates: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'title',
                'description',
                'styleDirection',
                'occasion',
                'season',
                'formality',
                'confidence',
                'items',
              ],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                styleDirection: { type: 'string' },
                occasion: { type: ['string', 'null'] },
                season: { type: ['string', 'null'] },
                formality: { type: ['string', 'null'] },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                items: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 8,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['wardrobeItemId', 'role'],
                    properties: {
                      wardrobeItemId: { type: 'string' },
                      role: {
                        type: 'string',
                        enum: [
                          'tops',
                          'bottoms',
                          'shoes',
                          'outerwear',
                          'accessories',
                          'dresses',
                          'bags',
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: [
          'status',
          'message',
          'missingCategories',
          'availableCategories',
        ],
        properties: {
          status: { const: 'insufficient_wardrobe' },
          message: { type: 'string' },
          missingCategories: {
            type: 'array',
            items: { type: 'string' },
          },
          availableCategories: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['status', 'message', 'retryable'],
        properties: {
          status: { const: 'generation_failed' },
          message: { type: 'string' },
          retryable: { type: 'boolean' },
        },
      },
    ],
  },
}

function toCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions')
    ? trimmed
    : `${trimmed}/chat/completions`
}

function clampTimeout(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_REQUEST_TIMEOUT_MS
  return Math.min(
    Math.max(value, MIN_REQUEST_TIMEOUT_MS),
    MAX_REQUEST_TIMEOUT_MS,
  )
}

export function getStylistRequestTimeoutMs(modelId?: string) {
  const configured = Number(process.env.STYLIST_AI_REQUEST_TIMEOUT_MS)
  const modelOverride = modelId
    ? modelCapabilities[modelId]?.timeoutMs
    : undefined
  return clampTimeout(modelOverride ?? configured)
}

export function getStylistModelCapability(modelId: string): ModelCapability {
  return (
    modelCapabilities[modelId] ?? {
      supportsJsonSchema: true,
      supportsJsonObject: true,
    }
  )
}

function getInitialResponseFormatMode(modelId: string): ResponseFormatMode {
  const capability = getStylistModelCapability(modelId)
  if (!capability.supportsJsonObject && !capability.supportsJsonSchema) {
    throw new StylistProviderRequestError(
      `Configured stylist model does not advertise JSON output support: ${modelId}`,
      'stylist_model_json_unsupported',
      422,
      false,
      {},
    )
  }

  return capability.supportsJsonSchema ? 'json_schema' : 'json_object'
}

function shouldRetryProviderRequest(error: unknown) {
  if (error instanceof StylistProviderRequestError) {
    return error.retryable
  }

  return error instanceof TypeError
}

function shouldFallbackToJsonObject(status: number, mode: ResponseFormatMode) {
  return mode === 'json_schema' && status === 400
}

function isTransientStatus(status: number) {
  return status === 502 || status === 503
}

function logProviderRequestExit(
  event:
    | 'PROVIDER_REQUEST_COMPLETED'
    | 'PROVIDER_REQUEST_FAILED'
    | 'PROVIDER_REQUEST_TIMED_OUT',
  details: {
    modelId: string
    requestStartedAt: string
    elapsedMs: number
    timeoutMs: number
    requestCount: number
    responseFormatMode: ResponseFormatMode
    aborted: boolean
    httpStatus?: number
  },
) {
  console.info(`[stylist-provider] ${event}`, {
    modelId: details.modelId,
    requestStartedAt: details.requestStartedAt,
    elapsedMs: details.elapsedMs,
    timeoutMs: details.timeoutMs,
    requestCount: details.requestCount,
    responseFormatMode: details.responseFormatMode,
    aborted: details.aborted,
    httpStatus: details.httpStatus ?? null,
  })
}

export class ApiStylistProvider implements StylistProvider {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly modelId: string

  constructor(config: ApiStylistProviderConfig) {
    this.apiKey = config.apiKey
    this.endpoint = toCompletionsUrl(config.baseUrl)
    this.modelId = config.modelId
  }

  private async requestOutfit(
    input: StylistProviderInput,
    responseFormatMode: ResponseFormatMode,
    requestCount: number,
  ): Promise<ProviderRequestResult> {
    const timeoutMs = getStylistRequestTimeoutMs(this.modelId)
    const requestStartedAt = new Date().toISOString()
    const startedAt = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response | null = null
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.OPENROUTER_HTTP_REFERER ??
            process.env.NEXT_PUBLIC_APP_URL ??
            'http://localhost:3000',
          'X-OpenRouter-Title': 'Vestra',
        },
        body: JSON.stringify({
          model: this.modelId,
          response_format:
            responseFormatMode === 'json_schema'
              ? { type: 'json_schema', json_schema: responseJsonSchema }
              : { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: input.strictRetry
                ? `STRICT RETRY: Return valid JSON only. Use only supplied wardrobeItemId values. Include the missing required roles if possible: ${input.missingItems.join(', ') || 'none'}. Return status="success" only when outfit.items has valid owned items for every required role. Otherwise return status="insufficient_wardrobe" with missingCategories and availableCategories. Never invent IDs.`
                : 'Return JSON only. Use only wardrobeItemId values from the supplied candidate list. Never invent item IDs. If no valid complete combination exists, return {"status":"insufficient_wardrobe","message":"...","missingCategories":[],"availableCategories":[]}. If a valid outfit exists, return {"status":"success","outfit":{...}}. Never return status="success" with an empty items array. Respond in the requested locale.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                locale: input.locale,
                request: input.request,
                wardrobeItems: input.wardrobeItems,
                missingItems: input.missingItems,
                weatherContext: input.request.weatherContext,
                locationName: input.request.locationName,
                occasion: input.request.occasion,
                wearHistoryMode: input.request.wearHistoryMode,
                preferenceContext: input.preferenceContext,
              }),
            },
          ],
        }),
      })
    } catch (error) {
      const elapsedMs = Math.round(performance.now() - startedAt)
      const aborted =
        error instanceof DOMException && error.name === 'AbortError'
      logProviderRequestExit(
        aborted ? 'PROVIDER_REQUEST_TIMED_OUT' : 'PROVIDER_REQUEST_FAILED',
        {
          modelId: this.modelId,
          requestStartedAt,
          elapsedMs,
          timeoutMs,
          requestCount,
          responseFormatMode,
          aborted,
        },
      )

      if (aborted) {
        throw new StylistProviderRequestError(
          'Stylist provider request timed out.',
          'stylist_provider_timeout',
          504,
          true,
          {
            elapsedMs,
            timeoutMs,
            responseFormatMode,
            requestCount,
            aborted: true,
          },
        )
      }

      throw new StylistProviderRequestError(
        'Stylist provider network request failed.',
        'stylist_provider_network_error',
        502,
        true,
        {
          elapsedMs,
          timeoutMs,
          responseFormatMode,
          requestCount,
          aborted: false,
        },
      )
    } finally {
      clearTimeout(timeout)
    }

    const elapsedMs = Math.round(performance.now() - startedAt)

    if (!response.ok && responseFormatMode !== 'json_schema') {
      logProviderRequestExit('PROVIDER_REQUEST_FAILED', {
        modelId: this.modelId,
        requestStartedAt,
        elapsedMs,
        timeoutMs,
        requestCount,
        responseFormatMode,
        aborted: false,
        httpStatus: response.status,
      })
      throw new StylistProviderRequestError(
        `Stylist provider failed with status ${response.status}`,
        isTransientStatus(response.status)
          ? 'stylist_provider_unavailable'
          : 'stylist_provider_request_failed',
        isTransientStatus(response.status) ? 502 : response.status,
        isTransientStatus(response.status),
        {
          httpStatus: response.status,
          elapsedMs,
          timeoutMs,
          responseFormatMode,
          requestCount,
          aborted: false,
        },
      )
    }

    if (!response.ok) {
      logProviderRequestExit('PROVIDER_REQUEST_FAILED', {
        modelId: this.modelId,
        requestStartedAt,
        elapsedMs,
        timeoutMs,
        requestCount,
        responseFormatMode,
        aborted: false,
        httpStatus: response.status,
      })
      return {
        ok: false as const,
        httpStatus: response.status,
        output: null,
        elapsedMs,
        aborted: false,
      }
    }

    try {
      const json = (await response.json()) as ChatCompletionResponse
      const content = json.choices?.[0]?.message?.content
      const output =
        typeof content === 'string'
          ? parseProviderJson(content)
          : (content ?? json)

      logProviderRequestExit('PROVIDER_REQUEST_COMPLETED', {
        modelId: this.modelId,
        requestStartedAt,
        elapsedMs,
        timeoutMs,
        requestCount,
        responseFormatMode,
        aborted: false,
        httpStatus: response.status,
      })

      return {
        ok: true as const,
        httpStatus: response.status,
        output,
        elapsedMs,
        aborted: false,
      }
    } catch (error) {
      logProviderRequestExit('PROVIDER_REQUEST_FAILED', {
        modelId: this.modelId,
        requestStartedAt,
        elapsedMs,
        timeoutMs,
        requestCount,
        responseFormatMode,
        aborted: false,
        httpStatus: response.status,
      })
      throw error
    }
  }

  async generateOutfit(
    input: StylistProviderInput,
  ): Promise<StylistProviderEnvelope> {
    let requestCount = 1
    let responseFormatMode = getInitialResponseFormatMode(this.modelId)
    let strictResult: Awaited<ReturnType<ApiStylistProvider['requestOutfit']>>
    let lastError: unknown

    try {
      strictResult = await this.requestOutfit(
        input,
        responseFormatMode,
        requestCount,
      )
    } catch (error) {
      if (!shouldRetryProviderRequest(error)) throw error
      lastError = error
      strictResult = {
        ok: false,
        httpStatus:
          error instanceof StylistProviderRequestError
            ? (error.detail.httpStatus ?? error.status)
            : 502,
        output: null,
        elapsedMs:
          error instanceof StylistProviderRequestError
            ? (error.detail.elapsedMs ?? 0)
            : 0,
        aborted:
          error instanceof StylistProviderRequestError
            ? Boolean(error.detail.aborted)
            : false,
      }
    }

    if (strictResult.ok) {
      return {
        output: strictResult.output,
        metadata: {
          httpStatus: strictResult.httpStatus,
          modelId: this.modelId,
          responseFormatMode,
          requestCount,
          retryCount: 0,
          fallbackUsed: false,
          elapsedMs: strictResult.elapsedMs,
          timeoutMs: getStylistRequestTimeoutMs(this.modelId),
          aborted: false,
        },
      }
    }

    if (
      !shouldFallbackToJsonObject(
        strictResult.httpStatus,
        responseFormatMode,
      ) &&
      !(lastError instanceof StylistProviderRequestError && lastError.retryable)
    ) {
      throw new StylistProviderRequestError(
        `Stylist provider failed with status ${strictResult.httpStatus}`,
        'stylist_provider_request_failed',
        strictResult.httpStatus,
        false,
        {
          httpStatus: strictResult.httpStatus,
          elapsedMs: strictResult.elapsedMs,
          timeoutMs: getStylistRequestTimeoutMs(this.modelId),
          responseFormatMode,
          requestCount,
          aborted: strictResult.aborted,
        },
      )
    }

    requestCount += 1
    responseFormatMode = 'json_object'
    const fallbackResult = await this.requestOutfit(
      input,
      responseFormatMode,
      requestCount,
    )
    if (!fallbackResult.ok) {
      throw new StylistProviderRequestError(
        `Stylist provider failed with status ${fallbackResult.httpStatus}`,
        isTransientStatus(fallbackResult.httpStatus)
          ? 'stylist_provider_unavailable'
          : 'stylist_provider_request_failed',
        isTransientStatus(fallbackResult.httpStatus)
          ? 502
          : fallbackResult.httpStatus,
        isTransientStatus(fallbackResult.httpStatus),
        {
          httpStatus: fallbackResult.httpStatus,
          elapsedMs: fallbackResult.elapsedMs,
          timeoutMs: getStylistRequestTimeoutMs(this.modelId),
          responseFormatMode,
          requestCount,
          aborted: false,
        },
      )
    }

    return {
      output: fallbackResult.output,
      metadata: {
        httpStatus: fallbackResult.httpStatus,
        modelId: this.modelId,
        responseFormatMode,
        requestCount,
        retryCount: 1,
        fallbackUsed: true,
        elapsedMs: fallbackResult.elapsedMs,
        timeoutMs: getStylistRequestTimeoutMs(this.modelId),
        aborted: false,
      },
    }
  }
}
