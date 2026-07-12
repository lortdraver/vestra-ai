import { ApiBackgroundRemovalProvider } from './api-provider'
import { MockBackgroundRemovalProvider } from './mock-provider'
import type { BackgroundRemovalProvider } from './provider'

export function getBackgroundRemovalProvider(): BackgroundRemovalProvider {
  const provider = process.env.BACKGROUND_REMOVAL_PROVIDER ?? 'mock'

  if (provider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock background removal is not allowed in production')
    }

    return new MockBackgroundRemovalProvider()
  }

  if (provider === 'api') {
    return new ApiBackgroundRemovalProvider()
  }

  throw new Error(`Unsupported background removal provider: ${provider}`)
}
