import { ApiStylistProvider } from './api-provider'
import { MockStylistProvider } from './mock-provider'
import type { StylistProvider } from './types'

export function getStylistProvider(): StylistProvider {
  const provider = process.env.STYLIST_AI_PROVIDER ?? 'mock'

  if (provider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock stylist provider is not allowed in production')
    }

    return new MockStylistProvider()
  }

  if (provider === 'api') {
    return new ApiStylistProvider()
  }

  throw new Error(`Unsupported stylist provider: ${provider}`)
}

export * from './types'
export * from './batch'
