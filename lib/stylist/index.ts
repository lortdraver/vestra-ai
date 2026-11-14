import { ApiStylistProvider } from './api-provider'
import { MockStylistProvider } from './mock-provider'
import { RuleStylistProvider } from './rule-provider'
import type { StylistProvider } from './types'

type ResolvedStylistProviderConfig =
  | {
      provider: 'mock'
      diagnostics: StylistProviderDiagnostics
    }
  | {
      provider: 'rules'
      diagnostics: StylistProviderDiagnostics
    }
  | {
      provider: 'api'
      apiKey: string
      baseUrl: string
      modelId: string
      diagnostics: StylistProviderDiagnostics
    }

export type StylistProviderDiagnostics = {
  resolvedProvider: 'mock' | 'api' | 'rules'
  configuredProvider: string | null
  hasApiKey: boolean
  hasBaseUrl: boolean
  hasModelId: boolean
  modelId: string | null
  requestUrlHost: string | null
}

function getRequestUrlHost(baseUrl: string | undefined) {
  if (!baseUrl) return null

  try {
    return new URL(baseUrl).host
  } catch {
    return null
  }
}

function getApiCredentials() {
  const apiKey = process.env.STYLIST_AI_API_KEY || process.env.AI_API_KEY
  const baseUrl = process.env.STYLIST_AI_API_URL || process.env.AI_API_BASE_URL
  const modelId = process.env.STYLIST_AI_MODEL_ID || process.env.AI_MODEL_ID

  return { apiKey, baseUrl, modelId }
}

function isPaidAiForcedOff() {
  const value = process.env.AI_FEATURES_DISABLED?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

export function resolveStylistProviderConfig(): ResolvedStylistProviderConfig {
  const configuredProvider = process.env.STYLIST_AI_PROVIDER?.trim() || null
  const { apiKey, baseUrl, modelId } = getApiCredentials()
  const hasRealCredentials = Boolean(apiKey && baseUrl && modelId)
  const resolvedProvider =
    configuredProvider ?? (hasRealCredentials ? 'api' : null)
  const rulesConfig = (): ResolvedStylistProviderConfig => ({
    provider: 'rules',
    diagnostics: {
      resolvedProvider: 'rules',
      configuredProvider,
      hasApiKey: Boolean(apiKey),
      hasBaseUrl: Boolean(baseUrl),
      hasModelId: Boolean(modelId),
      modelId: null,
      requestUrlHost: null,
    },
  })

  // Paid AI paused or not configured: fall back to the free rule-based
  // stylist instead of failing every request.
  if (isPaidAiForcedOff() || resolvedProvider === 'rules') return rulesConfig()

  if (resolvedProvider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock stylist provider is not allowed in production')
    }

    return {
      provider: 'mock',
      diagnostics: {
        resolvedProvider: 'mock',
        configuredProvider,
        hasApiKey: Boolean(apiKey),
        hasBaseUrl: Boolean(baseUrl),
        hasModelId: Boolean(modelId),
        modelId: modelId ?? null,
        requestUrlHost: getRequestUrlHost(baseUrl),
      },
    }
  }

  if (resolvedProvider === 'api' || resolvedProvider === 'openai-compatible') {
    if (!apiKey || !baseUrl || !modelId) return rulesConfig()

    return {
      provider: 'api',
      apiKey,
      baseUrl,
      modelId,
      diagnostics: {
        resolvedProvider: 'api',
        configuredProvider,
        hasApiKey: true,
        hasBaseUrl: true,
        hasModelId: true,
        modelId,
        requestUrlHost: getRequestUrlHost(baseUrl),
      },
    }
  }

  if (!resolvedProvider) return rulesConfig()

  throw new Error(`Unsupported stylist provider: ${resolvedProvider}`)
}

export function getStylistProviderDiagnostics(): StylistProviderDiagnostics {
  return resolveStylistProviderConfig().diagnostics
}

export function getStylistProvider(): StylistProvider {
  const config = resolveStylistProviderConfig()
  if (config.provider === 'mock') {
    return new MockStylistProvider()
  }
  if (config.provider === 'rules') {
    return new RuleStylistProvider()
  }

  return new ApiStylistProvider(config)
}

export * from './types'
export * from './batch'
export * from './fashion-rules'
export * from './scoring'
export {
  StylistProviderRequestError,
  getStylistModelCapability,
  getStylistRequestTimeoutMs,
} from './api-provider'
