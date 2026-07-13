import type { StylistProvider, StylistProviderInput } from './types'

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

  async generateOutfit(input: StylistProviderInput): Promise<unknown> {
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
        response_format: { type: 'json_object' },
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

    if (!response.ok) {
      throw new Error(`Stylist provider failed with status ${response.status}`)
    }

    const json = (await response.json()) as ChatCompletionResponse
    const content = json.choices?.[0]?.message?.content

    if (typeof content === 'string') {
      return JSON.parse(content) as unknown
    }

    return content ?? json
  }
}
