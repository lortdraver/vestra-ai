import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  compressWardrobeImage,
  getCompressedImageFileName,
  getPreferredExportTypes,
  maxClientImageDimension,
} from '@/lib/wardrobe/image-compression'
import { validateImageFile } from '@/lib/wardrobe/validation'

type CanvasExport = {
  mimeType: string
  quality: number
  width: number
  height: number
}

const wardrobeClientSource = readFileSync(
  join(process.cwd(), 'components/wardrobe/wardrobe-page-client.tsx'),
  'utf8',
)
const compressionSource = readFileSync(
  join(process.cwd(), 'lib/wardrobe/image-compression.ts'),
  'utf8',
)

function installBrowserImageMocks(options: {
  imageWidth?: number
  imageHeight?: number
  createImageBitmap?: 'missing' | 'throws' | 'works'
  failMimeTypes?: string[]
  failAllExports?: boolean
  outputSize?: number
}) {
  const exports: CanvasExport[] = []
  const contextOptions: unknown[] = []

  class MockImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    naturalWidth = options.imageWidth ?? 2048
    naturalHeight = options.imageHeight ?? 2560
    width = this.naturalWidth
    height = this.naturalHeight

    set src(_value: string) {
      queueMicrotask(() => this.onload?.())
    }
  }

  vi.stubGlobal('Image', MockImage)
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:wardrobe-test'),
    revokeObjectURL: vi.fn(),
  })
  vi.stubGlobal('HTMLCanvasElement', function HTMLCanvasElement() {})
  ;(
    globalThis.HTMLCanvasElement as unknown as { prototype: unknown }
  ).prototype = { toBlob: true }

  vi.stubGlobal('document', {
    createElement: vi.fn(() => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn((_type: string, contextOption: unknown) => {
          contextOptions.push(contextOption)
          return {
            drawImage: vi.fn(),
            getImageData: vi.fn(() => ({
              data: new Uint8ClampedArray(
                Math.max(1, canvas.width * canvas.height * 4),
              ),
            })),
          }
        }),
        toBlob: vi.fn(
          (
            callback: (blob: Blob | null) => void,
            mimeType = 'image/png',
            quality = 1,
          ) => {
            exports.push({
              mimeType,
              quality,
              width: canvas.width,
              height: canvas.height,
            })
            if (
              options.failAllExports ||
              options.failMimeTypes?.includes(mimeType)
            ) {
              callback(null)
              return
            }
            callback(
              new Blob([new Uint8Array(options.outputSize ?? 128_000)], {
                type: mimeType,
              }),
            )
          },
        ),
      }
      return canvas
    }),
  })

  if (options.createImageBitmap === 'missing') {
    vi.stubGlobal('createImageBitmap', undefined)
  } else if (options.createImageBitmap === 'throws') {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('bitmap_failed'))),
    )
  } else {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() =>
        Promise.resolve({
          width: options.imageWidth ?? 2048,
          height: options.imageHeight ?? 2560,
          close: vi.fn(),
        }),
      ),
    )
  }

  vi.stubGlobal('OffscreenCanvas', undefined)

  return { exports, contextOptions }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('wardrobe client image compression', () => {
  it('resizes a portrait phone JPEG without depending on WebP export', async () => {
    const browser = installBrowserImageMocks({
      imageWidth: 2048,
      imageHeight: 2560,
      createImageBitmap: 'works',
    })
    const file = new File([new Uint8Array(971_000)], 'iphone-photo.jpg', {
      type: 'image/jpeg',
    })

    const result = await compressWardrobeImage(file)

    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('iphone-photo.jpg')
    expect(browser.exports[0]).toMatchObject({
      mimeType: 'image/jpeg',
      width: 1440,
      height: maxClientImageDimension,
    })
  })

  it('uses HTMLImageElement fallback when createImageBitmap is unavailable', async () => {
    installBrowserImageMocks({ createImageBitmap: 'missing' })
    const file = new File([new Uint8Array(600_000)], 'shirt.jpg', {
      type: 'image/jpeg',
    })

    await expect(compressWardrobeImage(file)).resolves.toMatchObject({
      type: 'image/jpeg',
    })
  })

  it('uses HTMLImageElement fallback when createImageBitmap throws', async () => {
    installBrowserImageMocks({ createImageBitmap: 'throws' })
    const file = new File([new Uint8Array(600_000)], 'shirt.jpg', {
      type: 'image/jpeg',
    })

    await expect(compressWardrobeImage(file)).resolves.toMatchObject({
      type: 'image/jpeg',
    })
  })

  it('falls back from WebP export to PNG for transparent inputs', async () => {
    const browser = installBrowserImageMocks({
      createImageBitmap: 'missing',
      failMimeTypes: ['image/webp'],
    })
    const file = new File([new Uint8Array(600_000)], 'transparent.png', {
      type: 'image/png',
    })

    const result = await compressWardrobeImage(file)

    expect(result.type).toBe('image/png')
    expect(result.name).toBe('transparent.png')
    expect(browser.exports.map((entry) => entry.mimeType)).toEqual([
      'image/webp',
      'image/png',
    ])
    expect(browser.contextOptions).toContainEqual({ alpha: true })
  })

  it('rejects when every canvas export fails so the UI can use the original', async () => {
    installBrowserImageMocks({
      createImageBitmap: 'missing',
      failAllExports: true,
    })
    const file = new File([new Uint8Array(600_000)], 'shirt.jpg', {
      type: 'image/jpeg',
    })

    await expect(compressWardrobeImage(file)).rejects.toThrow(
      'canvas_export_failed',
    )
  })

  it('keeps extension and MIME type consistent', () => {
    expect(getCompressedImageFileName('photo.jpeg', 'image/jpeg')).toBe(
      'photo.jpg',
    )
    expect(getCompressedImageFileName('photo.jpg', 'image/webp')).toBe(
      'photo.webp',
    )
    expect(
      getPreferredExportTypes(
        new File(['x'], 'x.jpg', {
          type: 'image/jpeg',
        }),
      ),
    ).toEqual(['image/jpeg', 'image/webp'])
  })

  it('documents EXIF-aware bitmap decode and Safari fallback in source', () => {
    expect(compressionSource).toContain("imageOrientation: 'from-image'")
    expect(compressionSource).toContain('decodeWithHtmlImage(file)')
    expect(compressionSource).toContain('CLIENT_IMAGE_FALLBACK_ORIGINAL')
  })

  it('rejects genuinely unsupported HEIC/HEIF files as invalid type', () => {
    const file = new File([new Uint8Array(200_000)], 'photo.heic', {
      type: 'image/heic',
    })

    expect(validateImageFile(file)).toEqual({
      ok: false,
      message: 'invalid_image_type',
      status: 400,
    })
  })

  it('keeps upload usable when optional compression fails for valid original files', () => {
    expect(wardrobeClientSource).toContain('setImageFile(file)')
    expect(wardrobeClientSource).toContain('CLIENT_IMAGE_FALLBACK_ORIGINAL')
    expect(wardrobeClientSource).not.toContain('setError(t.errors.compress)')
  })
})
