import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiBackgroundRemovalProvider } from '@/lib/background-removal/api-provider'
import { getBackgroundRemovalProvider } from '@/lib/background-removal'
import { RemoveBgBackgroundRemovalProvider } from '@/lib/background-removal/removebg-provider'
import { BackgroundRemovalProviderError } from '@/lib/background-removal/provider'

const twoByTwoPng = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNk+M+ABzAxMIjGoQMAWnMCCXy6X6QAAAAASUVORK5CYII=',
    'base64',
  ),
)

function readPngDimensions(bytes: Uint8Array) {
  const dataView = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  )
  return {
    width: dataView.getUint32(16),
    height: dataView.getUint32(20),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('background removal provider behavior', () => {
  it('uses the mock provider in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('BACKGROUND_REMOVAL_PROVIDER', 'mock')
    const inputFile = new File([twoByTwoPng], 'item.png', {
      type: 'image/png',
      lastModified: 1_700_000_000_000,
    })

    const result = await getBackgroundRemovalProvider().removeBackground({
      userId: 'user_1',
      file: inputFile,
      mode: 'single_item',
    })
    const returnedBytes = new Uint8Array(await result.file.arrayBuffer())
    const dimensions = readPngDimensions(returnedBytes)

    expect(result.provider).toBe('mock')
    expect(result.modelId).toBe('mock-background-removal-v1')
    expect(result.file.name).toBe('item.png')
    expect(result.file.type).toBe('image/png')
    expect(result.file.lastModified).toBe(inputFile.lastModified)
    expect(dimensions.width).toBeGreaterThan(1)
    expect(dimensions.height).toBeGreaterThan(1)
    expect(returnedBytes).toEqual(twoByTwoPng)
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

  it('selects the remove.bg provider', () => {
    vi.stubEnv('BACKGROUND_REMOVAL_PROVIDER', 'removebg')
    vi.stubEnv('BACKGROUND_REMOVAL_API_KEY', 'test-key')

    expect(getBackgroundRemovalProvider()).toBeInstanceOf(
      RemoveBgBackgroundRemovalProvider,
    )
  })

  it('uses remove.bg X-Api-Key auth, image_file multipart field, and size auto', async () => {
    vi.stubEnv('BACKGROUND_REMOVAL_API_KEY', 'test-key')
    vi.stubEnv(
      'BACKGROUND_REMOVAL_API_URL',
      'https://api.remove.bg/v1.0/removebg',
    )
    vi.stubEnv('BACKGROUND_REMOVAL_SIZE', 'auto')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob([twoByTwoPng], { type: 'image/png' }), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    )

    const result =
      await new RemoveBgBackgroundRemovalProvider().removeBackground({
        userId: 'user_1',
        file: new File([twoByTwoPng], 'shirt.webp', { type: 'image/webp' }),
        mode: 'single_item',
      })
    const [, init] = fetchMock.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    const body = init?.body as FormData

    expect(headers['X-Api-Key']).toBe('test-key')
    expect(headers.Authorization).toBeUndefined()
    expect(body.get('image_file')).toBeInstanceOf(File)
    expect(body.get('size')).toBe('auto')
    expect(result.provider).toBe('removebg')
    expect(result.modelId).toBe('removebg-v1')
    expect(result.file.name).toBe('processed-shirt.png')
    expect(result.file.type).toBe('image/png')
    expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(twoByTwoPng)
  })

  it('maps remove.bg 403 to invalid api key', async () => {
    vi.stubEnv('BACKGROUND_REMOVAL_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 }),
    )

    await expect(
      new RemoveBgBackgroundRemovalProvider().removeBackground({
        userId: 'user_1',
        file: new File([twoByTwoPng], 'shirt.png', { type: 'image/png' }),
      }),
    ).rejects.toMatchObject({
      code: 'background_removal_invalid_api_key',
      status: 403,
    } satisfies Partial<BackgroundRemovalProviderError>)
  })

  it('maps remove.bg 402 to insufficient credits', async () => {
    vi.stubEnv('BACKGROUND_REMOVAL_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('payment required', { status: 402 }),
    )

    await expect(
      new RemoveBgBackgroundRemovalProvider().removeBackground({
        userId: 'user_1',
        file: new File([twoByTwoPng], 'shirt.png', { type: 'image/png' }),
      }),
    ).rejects.toMatchObject({
      code: 'background_removal_insufficient_credits',
      status: 402,
    } satisfies Partial<BackgroundRemovalProviderError>)
  })

  it('preserves the original image when remove.bg fails', async () => {
    vi.stubEnv('BACKGROUND_REMOVAL_API_KEY', 'test-key')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 }),
    )
    const originalFile = new File([twoByTwoPng], 'shirt.png', {
      type: 'image/png',
    })

    await expect(
      new RemoveBgBackgroundRemovalProvider().removeBackground({
        userId: 'user_1',
        file: originalFile,
      }),
    ).rejects.toBeInstanceOf(BackgroundRemovalProviderError)

    expect(new Uint8Array(await originalFile.arrayBuffer())).toEqual(
      twoByTwoPng,
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
