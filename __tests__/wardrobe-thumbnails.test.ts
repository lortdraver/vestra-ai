import sharp from 'sharp'
import type { Sharp } from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  generateWardrobeThumbnail,
  hasValidThumbnailRecord,
  selectThumbnailSource,
  selectThumbnailUrl,
  WARDROBE_THUMBNAIL_CONTENT_TYPE,
  WARDROBE_THUMBNAIL_MAX_DIMENSION,
  WARDROBE_THUMBNAIL_QUALITY,
} from '@/lib/wardrobe/thumbnails'

async function fileFromSharp(image: Sharp, name: string, type: string) {
  return new File([await image.toBuffer()], name, { type })
}

describe('wardrobe thumbnails', () => {
  it('creates a bounded JPEG thumbnail without touching the source file', async () => {
    const file = await fileFromSharp(
      sharp({
        create: {
          width: 1200,
          height: 800,
          channels: 3,
          background: '#d8d8d8',
        },
      }).jpeg({ quality: 95 }),
      'shirt.jpg',
      'image/jpeg',
    )

    const thumbnail = await generateWardrobeThumbnail(file)
    const metadata = await sharp(await thumbnail.file.arrayBuffer()).metadata()

    expect(thumbnail.contentType).toBe(WARDROBE_THUMBNAIL_CONTENT_TYPE)
    expect(thumbnail.file.type).toBe(WARDROBE_THUMBNAIL_CONTENT_TYPE)
    expect(Math.max(thumbnail.width, thumbnail.height)).toBeLessThanOrEqual(
      WARDROBE_THUMBNAIL_MAX_DIMENSION,
    )
    expect(metadata.format).toBe('webp')
    expect(file.type).toBe('image/jpeg')
    expect(file.size).toBeGreaterThan(thumbnail.size)
  })

  it('preserves alpha for transparent PNG input', async () => {
    const file = await fileFromSharp(
      sharp({
        create: {
          width: 700,
          height: 900,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        },
      }).png(),
      'dress.png',
      'image/png',
    )

    const thumbnail = await generateWardrobeThumbnail(file)
    const metadata = await sharp(await thumbnail.file.arrayBuffer()).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.hasAlpha).toBe(true)
    expect(Math.max(thumbnail.width, thumbnail.height)).toBeLessThanOrEqual(
      WARDROBE_THUMBNAIL_MAX_DIMENSION,
    )
  })

  it('falls back to processed then original image URLs for display', () => {
    expect(
      selectThumbnailUrl({
        thumbnailImageUrl: '/api/wardrobe/images/thumb.webp',
        processedImageUrl: '/api/wardrobe/images/processed.png',
        imageUrl: '/api/wardrobe/images/original.webp',
      }),
    ).toBe('/api/wardrobe/images/thumb.webp')

    expect(
      selectThumbnailUrl({
        processedImageUrl: '/api/wardrobe/images/processed.png',
        imageUrl: '/api/wardrobe/images/original.webp',
      }),
    ).toBe('/api/wardrobe/images/processed.png')
  })

  it('uses the original image as thumbnail source when processing failed', () => {
    const original = new File(['original'], 'original.webp', {
      type: 'image/webp',
    })
    const source = selectThumbnailSource({
      original,
      originalStorageKey: 'wardrobe/user/original/item.webp',
      processed: null,
      processedStorageKey: null,
    })

    expect(source.source).toBe('original')
    expect(source.file).toBe(original)
  })

  it('uses processed images as thumbnail source when available', () => {
    const original = new File(['original'], 'original.webp', {
      type: 'image/webp',
    })
    const processed = new File(['processed'], 'processed.webp', {
      type: 'image/webp',
    })
    const source = selectThumbnailSource({
      original,
      originalStorageKey: 'wardrobe/user/original/item.webp',
      processed,
      processedStorageKey: 'wardrobe/user/processed/item.webp',
    })

    expect(source.source).toBe('processed')
    expect(source.file).toBe(processed)
  })

  it('detects existing valid thumbnails for idempotent backfills', () => {
    expect(
      hasValidThumbnailRecord({
        thumbnailImageUrl: '/api/wardrobe/images/wardrobe/user/thumb/a.webp',
        thumbnailImageStorageKey: 'wardrobe/user/thumb/a.webp',
        thumbnailImageContentType: 'image/webp',
        thumbnailImageSize: '12000',
        thumbnailImageWidth: 420,
        thumbnailImageHeight: 480,
      }),
    ).toBe(true)

    expect(
      hasValidThumbnailRecord({
        thumbnailImageUrl: '/api/wardrobe/images/wardrobe/user/thumb/a.webp',
      }),
    ).toBe(false)
  })

  it('documents the configured thumbnail quality', () => {
    expect(WARDROBE_THUMBNAIL_QUALITY).toBeGreaterThanOrEqual(75)
    expect(WARDROBE_THUMBNAIL_QUALITY).toBeLessThanOrEqual(85)
  })
})
