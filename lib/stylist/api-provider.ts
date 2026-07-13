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
    responseFormatMode: 'json_schema' | 'json_object',
  ) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
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

    if (!response.ok && responseFormatMode !== 'json_schema') {
      throw new Error(`Stylist provider failed with status ${response.status}`)
    }

    if (!response.ok) {
      return {
        ok: false as const,
        httpStatus: response.status,
        output: null,
      }
    }

    const json = (await response.json()) as ChatCompletionResponse
    const content = json.choices?.[0]?.message?.content
    const output =
      typeof content === 'string'
        ? parseProviderJson(content)
        : (content ?? json)

    return {
      ok: true as const,
      httpStatus: response.status,
      output,
    }
  }

  async generateOutfit(
    input: StylistProviderInput,
  ): Promise<StylistProviderEnvelope> {
    let requestCount = 1
    let responseFormatMode: 'json_schema' | 'json_object' = 'json_schema'
    let strictResult: Awaited<ReturnType<ApiStylistProvider['requestOutfit']>>

    try {
      strictResult = await this.requestOutfit(input, responseFormatMode)
    } catch {
      strictResult = {
        ok: false,
        httpStatus: 200,
        output: null,
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
        },
      }
    }

    requestCount += 1
    responseFormatMode = 'json_object'
    const fallbackResult = await this.requestOutfit(input, responseFormatMode)
    if (!fallbackResult.ok) {
      throw new Error(
        `Stylist provider failed with status ${fallbackResult.httpStatus}`,
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
      },
    }
  }
}
