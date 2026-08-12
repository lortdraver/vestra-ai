import { describe, expect, it, vi } from 'vitest'
import {
  sanitizeAnalyticsPath,
  sanitizeAnalyticsProperties,
} from '@/lib/analytics/sanitize'
import { analyticsEventNames } from '@/lib/analytics/events'

describe('first-party analytics privacy boundary', () => {
  it('exposes the canonical event taxonomy', () => {
    expect(analyticsEventNames).toContain('wardrobe_item_created')
    expect(analyticsEventNames).toContain('stylist_generation_completed')
    expect(analyticsEventNames).toContain('planner_outfit_scheduled')
  })

  it('rejects forbidden PII and sensitive payload keys', () => {
    const result = sanitizeAnalyticsProperties({
      category: 'tops',
      email: 'private@example.com',
      imageStorageKey: 'wardrobe/private-key',
      durationMs: 42,
    })
    expect(result.properties).toEqual({ category: 'tops', durationMs: 42 })
    expect(result.rejectedKeys).toEqual(['email', 'imageStorageKey'])
  })

  it('keeps only bounded scalar values and arrays', () => {
    const result = sanitizeAnalyticsProperties({
      locale: 'az',
      flags: [true, false],
      privateObject: { prompt: 'do not store' },
      tooLong: 'x'.repeat(201),
    })
    expect(result.properties).toEqual({ locale: 'az', flags: [true, false] })
    expect(result.rejectedKeys).toEqual(['privateObject'])
  })

  it('sanitizes paths without preserving query values', () => {
    expect(sanitizeAnalyticsPath('/dashboard/wardrobe?search=private')).toBe(
      '/dashboard/wardrobe?query',
    )
    expect(sanitizeAnalyticsPath('https://example.com/account')).toBe(
      '/account',
    )
  })
})

describe('first-party analytics server writer', () => {
  it('writes a valid event with a dedupe key without blocking the caller', async () => {
    vi.resetModules()
    const values = vi.fn().mockResolvedValue(undefined)
    const insert = vi.fn(() => ({ values }))
    vi.doMock('@/lib/db', () => ({ db: { insert } }))
    const { writeServerEvent } = await import('@/lib/analytics/server')

    await expect(
      writeServerEvent({
        eventName: 'wardrobe_item_created',
        userId: 'user-1',
        properties: { category: 'tops', durationMs: 12 },
        dedupeKey: 'wardrobe-item:item-1',
      }),
    ).resolves.toBe(true)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'wardrobe_item_created',
        userId: 'user-1',
        dedupeKey: 'wardrobe-item:item-1',
      }),
    )
  })

  it('swallows database failures and returns false', async () => {
    vi.resetModules()
    const values = vi.fn().mockRejectedValue(new Error('database unavailable'))
    vi.doMock('@/lib/db', () => ({ db: { insert: vi.fn(() => ({ values })) } }))
    const { writeServerEvent } = await import('@/lib/analytics/server')

    await expect(
      writeServerEvent({
        eventName: 'stylist_generation_failed',
        properties: { errorCode: 'timeout' },
      }),
    ).resolves.toBe(false)
  })

  it('returns aggregate event counts from the indexed query boundary', async () => {
    vi.resetModules()
    const where = vi.fn().mockResolvedValue([{ count: '3' }])
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))
    vi.doMock('@/lib/db', () => ({ db: { select } }))
    const { countEventsByRange } = await import('@/lib/analytics/server')

    await expect(
      countEventsByRange(
        {
          from: new Date('2026-01-01T00:00:00.000Z'),
          to: new Date('2026-01-02T00:00:00.000Z'),
        },
        'outfit_created',
      ),
    ).resolves.toBe(3)
  })
})
