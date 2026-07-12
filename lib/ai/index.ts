import { MockClothingAnalysisProvider } from './mock-provider'
import { OpenAICompatibleClothingAnalysisProvider } from './openai-compatible-provider'
import type { ClothingAnalysisProvider } from './provider'

export function getClothingAnalysisProvider(): ClothingAnalysisProvider {
  const provider = process.env.AI_PROVIDER ?? 'openai-compatible'

  if (provider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock AI provider is not allowed in production')
    }
    return new MockClothingAnalysisProvider()
  }

  if (provider === 'openai-compatible') {
    const apiKey = process.env.AI_API_KEY
    const baseUrl = process.env.AI_API_BASE_URL
    const modelId = process.env.AI_MODEL_ID

    if (!apiKey || !baseUrl || !modelId) {
      throw new Error(
        'Real AI provider is missing required environment variables',
      )
    }

    return new OpenAICompatibleClothingAnalysisProvider({
      apiKey,
      baseUrl,
      modelId,
    })
  }

  throw new Error(`Unsupported AI provider: ${provider}`)
}
