import type { StylistProvider, StylistProviderInput } from './types'

export class ApiStylistProvider implements StylistProvider {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly modelId: string

  constructor() {
    const apiKey = process.env.STYLIST_AI_API_KEY
    const endpoint = process.env.STYLIST_AI_API_URL

    if (!apiKey || !endpoint) {
      throw new Error(
        'Production stylist provider requires STYLIST_AI_API_KEY and STYLIST_AI_API_URL',
      )
    }

    this.apiKey = apiKey
    this.endpoint = endpoint
    this.modelId = process.env.STYLIST_AI_MODEL_ID ?? 'stylist-v1'
  }

  async generateOutfit(input: StylistProviderInput): Promise<unknown> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelId,
        locale: input.locale,
        instruction: input.strictRetry
          ? `STRICT RETRY: Return valid JSON only. Use only supplied wardrobeItemId values. Include the missing required roles if possible: ${input.missingItems.join(', ') || 'none'}. Return status="success" only when outfit.items has valid owned items for every required role. Otherwise return status="insufficient_wardrobe" with missingCategories and availableCategories. Never invent IDs.`
          : 'Return JSON only. Use only wardrobeItemId values from the supplied candidate list. Never invent item IDs. If no valid complete combination exists, return {"status":"insufficient_wardrobe","message":"...","missingCategories":[],"availableCategories":[]}. If a valid outfit exists, return {"status":"success","outfit":{...}}. Never return status="success" with an empty items array. Respond in the requested locale.',
        request: input.request,
        wardrobeItems: input.wardrobeItems,
        missingItems: input.missingItems,
        weatherContext: input.request.weatherContext,
        locationName: input.request.locationName,
        occasion: input.request.occasion,
        wearHistoryMode: input.request.wearHistoryMode,
        preferenceContext: input.preferenceContext,
      }),
    })

    if (!response.ok) {
      throw new Error(`Stylist provider failed with status ${response.status}`)
    }

    return response.json()
  }
}
