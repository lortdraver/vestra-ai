import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_CONTENT_CLASS,
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
const rootLayoutSource = readFileSync(
  join(process.cwd(), 'app/layout.tsx'),
  'utf8',
)
const globalsSource = readFileSync(
  join(process.cwd(), 'app/globals.css'),
  'utf8',
)
const appHeaderSource = readFileSync(
  join(process.cwd(), 'components/app-header.tsx'),
  'utf8',
)
const wardrobeImageRouteSource = readFileSync(
  join(process.cwd(), 'app/api/wardrobe/images/[...key]/route.ts'),
  'utf8',
)
const dashboardLayoutSource = readFileSync(
  join(process.cwd(), 'app/dashboard/layout.tsx'),
  'utf8',
)

describe('responsive UI contracts', () => {
  it('exports a Safari-safe mobile viewport', () => {
    expect(rootLayoutSource).toContain("width: 'device-width'")
    expect(rootLayoutSource).toContain('initialScale: 1')
    expect(rootLayoutSource).toContain("viewportFit: 'cover'")
  })

  it('does not create a fixed desktop canvas at the document root', () => {
    expect(globalsSource).toContain('min-w-0 max-w-full')
    expect(globalsSource).toContain('overflow-x-hidden')
    expect(globalsSource).not.toContain('min-width: 1024px')
    expect(globalsSource).not.toContain('width: 1440px')
    expect(globalsSource).not.toContain('transform: scale')
  })

  it('lets desktop dashboard content use the available viewport width', () => {
    expect(DASHBOARD_CONTENT_CLASS).toContain('w-full')
    expect(DASHBOARD_CONTENT_CLASS).toContain('max-w-[1680px]')
    expect(DASHBOARD_CONTENT_CLASS).toContain('xl:px-8')
    expect(dashboardLayoutSource).toContain('DASHBOARD_CONTENT_CLASS')
    expect(dashboardLayoutSource).not.toContain('max-w-6xl flex-1')
  })

  it('keeps wardrobe cards compact across mobile, tablet, and desktop', () => {
    expect(WARDROBE_LAYOUT_CLASS).toContain('minmax(300px,340px)')
    expect(WARDROBE_GRID_CLASS).toContain('grid-cols-1')
    expect(WARDROBE_GRID_CLASS).toContain('min-[360px]:grid-cols-2')
    expect(WARDROBE_GRID_CLASS).toContain(
      'lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]',
    )
    expect(WARDROBE_CARD_IMAGE_CLASS).toContain('h-[170px]')
    expect(WARDROBE_CARD_IMAGE_CLASS).toContain('xl:h-[250px]')
  })

  it('keeps mobile and desktop navigation mutually exclusive', () => {
    expect(DESKTOP_NAV_CLASS).toContain('hidden')
    expect(DESKTOP_NAV_CLASS).toContain('md:flex')
    expect(MOBILE_BOTTOM_NAV_CLASS).toContain('fixed')
    expect(MOBILE_BOTTOM_NAV_CLASS).toContain('w-screen')
    expect(MOBILE_BOTTOM_NAV_CLASS).toContain('grid-cols-5')
    expect(MOBILE_BOTTOM_NAV_CLASS).toContain('env(safe-area-inset-bottom)')
    expect(MOBILE_BOTTOM_NAV_CLASS).toContain('md:hidden')
    expect(appHeaderSource).toContain('h-14')
    expect(appHeaderSource).toContain('md:h-16')
  })

  it('keeps wardrobe card actions touch friendly', () => {
    expect(WARDROBE_CARD_ACTION_CLASS).toContain('min-h-11')
    expect(WARDROBE_CARD_ACTION_CLASS).toContain('min-w-11')
  })

  it('lazy loads wardrobe card images without stretching them', () => {
    expect(wardrobeClientSource).toContain('src={item.thumbnailImageUrl}')
    expect(wardrobeClientSource).toContain('data-fallback-step')
    expect(wardrobeClientSource).toContain('item.processedImageUrl')
    expect(wardrobeClientSource).toContain('item.originalImageUrl')
    expect(wardrobeClientSource).toContain('loading="lazy"')
    expect(wardrobeClientSource).toContain('decoding="async"')
    expect(wardrobeClientSource).toContain('object-contain')
    expect(wardrobeClientSource).toContain('object-center')
    expect(wardrobeClientSource).toContain('sm:p-4')
    expect(wardrobeClientSource).not.toContain('object-cover')
  })

  it('collapses detailed wardrobe analytics on mobile', () => {
    expect(wardrobeClientSource).toContain('<details')
    expect(wardrobeClientSource).toContain('md:hidden')
    expect(wardrobeClientSource).toContain('hidden md:block')
    expect(wardrobeClientSource).toContain('compact')
  })

  it('keeps mobile wardrobe form controls at iOS-safe text size', () => {
    expect(wardrobeClientSource).toContain('text-base md:text-sm')
    expect(wardrobeClientSource).toContain('h-10')
  })

  it('keeps existing wardrobe item actions wired', () => {
    expect(wardrobeClientSource).toContain('recordWear(item)')
    expect(wardrobeClientSource).toContain('startEdit(item)')
    expect(wardrobeClientSource).toContain('handleDelete(item)')
    expect(wardrobeClientSource).toContain('selectItem(item)')
  })

  it('keeps private wardrobe image responses cacheable per user session', () => {
    expect(wardrobeImageRouteSource).toContain(
      'wardrobeItem.thumbnailImageStorageKey',
    )
    expect(wardrobeImageRouteSource).toContain('private, max-age=900')
    expect(wardrobeImageRouteSource).toContain('stale-while-revalidate=3600')
    expect(wardrobeImageRouteSource).toContain("Vary: 'Cookie'")
  })

  it('prefers thumbnail wardrobe images for cards while preserving originals', () => {
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
      thumbnailImageUrl: '/api/wardrobe/images/thumb.webp',
      thumbnailImageStorageKey: 'thumb.webp',
      thumbnailImageContentType: 'image/webp',
      thumbnailImageSize: '32000',
      thumbnailImageWidth: 360,
      thumbnailImageHeight: 480,
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
    expect(dto.thumbnailImageUrl).toBe('/api/wardrobe/images/thumb.webp')
    expect(dto.processedImageUrl).toBe('/api/wardrobe/images/processed.png')
    expect(dto.originalImageUrl).toBe('/api/wardrobe/images/original.webp')
    expect(dto.originalImageSize).toBe(1200000)
  })
})
