import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DESKTOP_NAV_CLASS,
  MOBILE_BOTTOM_NAV_CLASS,
  WARDROBE_CARD_ACTION_CLASS,
  WARDROBE_CARD_IMAGE_CLASS,
  WARDROBE_GRID_CLASS,
  WARDROBE_LAYOUT_CLASS,
} from '@/lib/ui/responsive'
import { toWardrobeItemDto } from '@/lib/wardrobe/serialize'

const wardrobeClientSource = readFileSync(
  join(process.cwd(), 'components/wardrobe/wardrobe-page-client.tsx'),
  'utf8',
)
const wardrobeImageRouteSource = readFileSync(
  join(process.cwd(), 'app/api/wardrobe/images/[...key]/route.ts'),
  'utf8',
)

describe('responsive UI contracts', () => {
  it('keeps wardrobe cards compact across mobile, tablet, and desktop', () => {
    expect(WARDROBE_LAYOUT_CLASS).toContain('minmax(300px,340px)')
    expect(WARDROBE_GRID_CLASS).toContain('grid-cols-1')
    expect(WARDROBE_GRID_CLASS).toContain('min-[360px]:grid-cols-2')
    expect(WARDROBE_GRID_CLASS).toContain('md:grid-cols-3')
    expect(WARDROBE_GRID_CLASS).toContain('xl:grid-cols-4')
    expect(WARDROBE_CARD_IMAGE_CLASS).toContain('h-[210px]')
    expect(WARDROBE_CARD_IMAGE_CLASS).toContain('xl:h-[260px]')
  })

  it('keeps mobile and desktop navigation mutually exclusive', () => {
    expect(DESKTOP_NAV_CLASS).toContain('hidden')
    expect(DESKTOP_NAV_CLASS).toContain('md:flex')
    expect(MOBILE_BOTTOM_NAV_CLASS).toContain('fixed')
    expect(MOBILE_BOTTOM_NAV_CLASS).toContain('grid-cols-5')
    expect(MOBILE_BOTTOM_NAV_CLASS).toContain('md:hidden')
  })

  it('keeps wardrobe card actions touch friendly', () => {
    expect(WARDROBE_CARD_ACTION_CLASS).toContain('min-h-11')
    expect(WARDROBE_CARD_ACTION_CLASS).toContain('min-w-11')
  })

  it('lazy loads wardrobe card images without stretching them', () => {
    expect(wardrobeClientSource).toContain('loading="lazy"')
    expect(wardrobeClientSource).toContain('decoding="async"')
    expect(wardrobeClientSource).toContain('object-contain')
  })

  it('keeps existing wardrobe item actions wired', () => {
    expect(wardrobeClientSource).toContain('recordWear(item)')
    expect(wardrobeClientSource).toContain('startEdit(item)')
    expect(wardrobeClientSource).toContain('handleDelete(item)')
    expect(wardrobeClientSource).toContain('selectItem(item)')
  })

  it('keeps private wardrobe image responses cacheable per user session', () => {
    expect(wardrobeImageRouteSource).toContain('private, max-age=900')
    expect(wardrobeImageRouteSource).toContain('stale-while-revalidate=3600')
    expect(wardrobeImageRouteSource).toContain("Vary: 'Cookie'")
  })

  it('prefers processed wardrobe images while preserving originals', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const dto = toWardrobeItemDto({
      id: 'item_1',
      userId: 'user_1',
      name: 'White shirt',
      category: 'tops',
      clothingType: 'shirt',
      colors: ['white'],
      seasons: ['spring'],
      styles: ['classic'],
      material: 'cotton',
      brand: 'Vestra',
      notes: '',
      imageUrl: '/api/wardrobe/images/original.webp',
      imageStorageKey: 'original.webp',
      imageContentType: 'image/webp',
      imageSize: '1200000',
      originalImageUrl: '/api/wardrobe/images/original.webp',
      originalImageStorageKey: 'original.webp',
      originalImageContentType: 'image/webp',
      originalImageSize: '1200000',
      processedImageUrl: '/api/wardrobe/images/processed.png',
      processedImageStorageKey: 'processed.png',
      processedImageContentType: 'image/png',
      processedImageSize: '420000',
      backgroundRemovalStatus: 'done',
      backgroundRemovalProvider: 'removebg',
      backgroundRemovalModelId: 'removebg-v1',
      backgroundRemovalError: null,
      aiAnalysis: null,
      userCorrections: null,
      analysisStatus: 'pending',
      analysisError: null,
      analysisPromptVersion: null,
      analysisModelId: null,
      analyzedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    } as never)

    expect(dto.imageUrl).toBe('/api/wardrobe/images/processed.png')
    expect(dto.processedImageUrl).toBe('/api/wardrobe/images/processed.png')
    expect(dto.originalImageUrl).toBe('/api/wardrobe/images/original.webp')
    expect(dto.originalImageSize).toBe(1200000)
  })
})
