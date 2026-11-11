import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  ImageSanitizeError,
  sanitizeUploadedImage,
  UPLOAD_MAX_DIMENSION,
} from '@/lib/wardrobe/image-sanitize'

async function makeImage(
  format: 'jpeg' | 'png' | 'webp',
  size = 32,
  withExif = false,
) {
  let pipeline = sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  }).toFormat(format)
  if (withExif) {
    pipeline = pipeline.withExif({ IFD0: { Copyright: 'secret-location' } })
  }
  return pipeline.toBuffer()
}

describe('uploaded image sanitization', () => {
  it('re-encodes a real image and keeps its detected format', async () => {
    const buffer = await makeImage('png')
    const file = new File([new Uint8Array(buffer)], 'shirt.png', {
      type: 'image/png',
    })

    const result = await sanitizeUploadedImage(file)

    expect(result.type).toBe('image/png')
    const meta = await sharp(
      new Uint8Array(await result.arrayBuffer()),
    ).metadata()
    expect(meta.format).toBe('png')
  })

  it('uses the decoded format, not the client-declared MIME type', async () => {
    const buffer = await makeImage('jpeg')
    const file = new File([new Uint8Array(buffer)], 'shirt.png', {
      type: 'image/png',
    })

    const result = await sanitizeUploadedImage(file)

    expect(result.type).toBe('image/jpeg')
  })

  it('strips EXIF metadata', async () => {
    const buffer = await makeImage('jpeg', 32, true)
    expect((await sharp(buffer).metadata()).exif).toBeDefined()
    const file = new File([new Uint8Array(buffer)], 'shirt.jpg', {
      type: 'image/jpeg',
    })

    const result = await sanitizeUploadedImage(file)

    const meta = await sharp(
      new Uint8Array(await result.arrayBuffer()),
    ).metadata()
    expect(meta.exif).toBeUndefined()
  })

  it('downscales oversized images', async () => {
    const buffer = await makeImage('webp', UPLOAD_MAX_DIMENSION + 400)
    const file = new File([new Uint8Array(buffer)], 'big.webp', {
      type: 'image/webp',
    })

    const result = await sanitizeUploadedImage(file)

    const meta = await sharp(
      new Uint8Array(await result.arrayBuffer()),
    ).metadata()
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(
      UPLOAD_MAX_DIMENSION,
    )
  })

  it('rejects bytes that are not a supported image', async () => {
    const file = new File(['<svg onload="alert(1)"></svg>'], 'x.png', {
      type: 'image/png',
    })

    await expect(sanitizeUploadedImage(file)).rejects.toBeInstanceOf(
      ImageSanitizeError,
    )
  })
})
