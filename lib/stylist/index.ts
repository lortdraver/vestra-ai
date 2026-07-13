import { ApiStylistProvider } from './api-provider'
import { MockStylistProvider } from './mock-provider'
import type { StylistProvider } from './types'

type ResolvedStylistProviderConfig =
  | {
      provider: 'mock'
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
  resolvedProvider: 'mock' | 'api'
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

function getMissingCredentialsMessage() {
  return [
    'Real stylist provider is missing required environment variables.',
    'Set AI_API_KEY, AI_API_BASE_URL, and AI_MODEL_ID, or set the STYLIST_AI_* equivalents.',
  ].join(' ')
}

export function resolveStylistProviderConfig(): ResolvedStylistProviderConfig {
  const configuredProvider = process.env.STYLIST_AI_PROVIDER?.trim() || null
  const { apiKey, baseUrl, modelId } = getApiCredentials()
  const hasRealCredentials = Boolean(apiKey && baseUrl && modelId)
  const resolvedProvider =
    configuredProvider ?? (hasRealCredentials ? 'api' : null)

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
    if (!apiKey || !baseUrl || !modelId) {
      throw new Error(getMissingCredentialsMessage())
    }

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

  if (!resolvedProvider) {
    throw new Error(
      `${getMissingCredentialsMessage()} For local mock mode, set STYLIST_AI_PROVIDER=mock explicitly.`,
    )
  }

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

  return new ApiStylistProvider(config)
}

export * from './types'
export * from './batch'
export {
  StylistProviderRequestError,
  getStylistModelCapability,
  getStylistRequestTimeoutMs,
} from './api-provider'
