import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiBackgroundRemovalProvider } from '@/lib/background-removal/api-provider'
import { getBackgroundRemovalProvider } from '@/lib/background-removal'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('background removal provider behavior', () => {
  it('uses the mock provider in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('BACKGROUND_REMOVAL_PROVIDER', 'mock')

    const result = await getBackgroundRemovalProvider().removeBackground({
      userId: 'user_1',
      file: new File(['image'], 'item.webp', { type: 'image/webp' }),
      mode: 'single_item',
    })

    expect(result.provider).toBe('mock')
    expect(result.modelId).toBe('mock-background-removal-v1')
    expect(result.file.name).toBe('mock-processed.png')
    expect(result.file.type).toBe('image/png')
  })

  it('blocks the mock provider in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BACKGROUND_REMOVAL_PROVIDER', 'mock')

    expect(() => getBackgroundRemovalProvider()).toThrow(
      'Mock background removal is not allowed in production',
    )
  })

  it('requires API credentials for the production provider', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BACKGROUND_REMOVAL_PROVIDER', 'api')

    expect(() => getBackgroundRemovalProvider()).toThrow(
      'Production background removal requires BACKGROUND_REMOVAL_API_KEY and BACKGROUND_REMOVAL_API_URL',
    )
  })

  it('uses the configured API provider and accepts binary processed images', async () => {
    vi.stubEnv('BACKGROUND_REMOVAL_API_KEY', 'test-key')
    vi.stubEnv('BACKGROUND_REMOVAL_API_URL', 'https://api.example.test/remove')
    vi.stubEnv('BACKGROUND_REMOVAL_MODEL_ID', 'real-bg-v1')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['processed'], { type: 'image/png' }), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    )

    const result = await new ApiBackgroundRemovalProvider().removeBackground({
      userId: 'user_1',
      file: new File(['original'], 'coat.webp', { type: 'image/webp' }),
      mode: 'single_item',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/remove',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    )
    expect(result.provider).toBe('api')
    expect(result.modelId).toBe('real-bg-v1')
    expect(result.file.name).toBe('processed-coat.png')
    expect(result.file.type).toBe('image/png')
  })

  it('accepts JSON responses with base64 processed images', async () => {
    vi.stubEnv('BACKGROUND_REMOVAL_API_KEY', 'test-key')
    vi.stubEnv('BACKGROUND_REMOVAL_API_URL', 'https://api.example.test/remove')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        imageBase64: btoa('transparent image'),
        contentType: 'image/png',
      }),
    )

    const result = await new ApiBackgroundRemovalProvider().removeBackground({
      userId: 'user_1',
      file: new File(['original'], 'dress.jpg', { type: 'image/jpeg' }),
    })

    expect(await result.file.text()).toBe('transparent image')
    expect(result.file.type).toBe('image/png')
  })
})
