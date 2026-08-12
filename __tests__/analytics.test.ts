import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ db: {} }))
import {
  buildAdminAnalyticsSnapshot,
  getAdminRange,
  resolveAdminRangePreset,
  type AdminAnalyticsSource,
} from '@/lib/analytics/admin'
import {
  sanitizeAnalyticsPath,
  sanitizeAnalyticsProperties,
} from '@/lib/analytics/sanitize'
import { analyticsEventNames } from '@/lib/analytics/events'

const adminPageSource = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/page.tsx'),
  'utf8',
)

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

function createAdminSource(): AdminAnalyticsSource {
  return {
    users: [
      {
        id: 'user-1',
        email: 'admin@vestra.test',
        emailVerified: true,
        createdAt: new Date('2026-08-10T09:00:00.000Z'),
      },
      {
        id: 'user-2',
        email: 'trial@vestra.test',
        emailVerified: true,
        createdAt: new Date('2026-08-11T10:00:00.000Z'),
      },
      {
        id: 'user-3',
        email: 'new@vestra.test',
        emailVerified: false,
        createdAt: new Date('2026-08-12T09:30:00.000Z'),
      },
    ],
    subscriptions: [
      {
        userId: 'user-1',
        planKey: 'premium',
        status: 'active',
        updatedAt: new Date('2026-08-12T08:00:00.000Z'),
      },
      {
        userId: 'user-2',
        planKey: 'premium',
        status: 'trialing',
        updatedAt: new Date('2026-08-11T08:00:00.000Z'),
      },
    ],
    wardrobeItems: [
      {
        userId: 'user-1',
        createdAt: new Date('2026-08-10T10:00:00.000Z'),
        category: 'tops',
        clothingType: 'shirt',
        colors: ['white'],
        styles: ['classic'],
        seasons: ['summer'],
        imageDeletionStatus: 'active',
        analysisStatus: 'done',
        backgroundRemovalStatus: 'done',
      },
      {
        userId: 'user-1',
        createdAt: new Date('2026-08-10T10:30:00.000Z'),
        category: 'bottoms',
        clothingType: 'trousers',
        colors: ['black'],
        styles: ['classic'],
        seasons: ['summer'],
        imageDeletionStatus: 'active',
        analysisStatus: 'failed',
        backgroundRemovalStatus: 'failed',
      },
      {
        userId: 'user-2',
        createdAt: new Date('2026-08-11T11:00:00.000Z'),
        category: 'shoes',
        clothingType: 'sneakers',
        colors: ['white'],
        styles: ['sport'],
        seasons: ['spring'],
        imageDeletionStatus: 'active',
        analysisStatus: 'done',
        backgroundRemovalStatus: 'done',
      },
    ],
    outfitRequests: [
      {
        userId: 'user-1',
        createdAt: new Date('2026-08-11T12:00:00.000Z'),
      },
      {
        userId: 'user-1',
        createdAt: new Date('2026-08-12T08:00:00.000Z'),
      },
      {
        userId: 'user-2',
        createdAt: new Date('2026-08-12T09:00:00.000Z'),
      },
    ],
    analyticsEvents: [
      {
        userId: 'user-1',
        eventName: 'wardrobe_item_created',
        occurredAt: new Date('2026-08-10T10:00:00.000Z'),
      },
      {
        userId: 'user-1',
        eventName: 'email_verified',
        occurredAt: new Date('2026-08-10T10:05:00.000Z'),
      },
      {
        userId: 'user-1',
        eventName: 'stylist_generation_completed',
        occurredAt: new Date('2026-08-11T12:00:00.000Z'),
      },
      {
        userId: 'user-1',
        eventName: 'stylist_generation_failed',
        occurredAt: new Date('2026-08-12T08:05:00.000Z'),
      },
      {
        userId: 'user-1',
        eventName: 'stylist_outfit_saved',
        occurredAt: new Date('2026-08-12T08:06:00.000Z'),
      },
      {
        userId: 'user-1',
        eventName: 'outfit_created',
        occurredAt: new Date('2026-08-12T08:07:00.000Z'),
      },
      {
        userId: 'user-1',
        eventName: 'planner_outfit_scheduled',
        occurredAt: new Date('2026-08-12T08:08:00.000Z'),
      },
      {
        userId: 'user-1',
        eventName: 'wardrobe_item_analysis_completed',
        occurredAt: new Date('2026-08-12T08:09:00.000Z'),
      },
      {
        userId: 'user-1',
        eventName: 'background_removal_completed',
        occurredAt: new Date('2026-08-12T08:10:00.000Z'),
      },
      {
        userId: 'user-2',
        eventName: 'wardrobe_item_created',
        occurredAt: new Date('2026-08-11T11:00:00.000Z'),
      },
      {
        userId: 'user-2',
        eventName: 'email_verified',
        occurredAt: new Date('2026-08-11T11:05:00.000Z'),
      },
      {
        userId: 'user-2',
        eventName: 'wardrobe_item_analysis_failed',
        occurredAt: new Date('2026-08-12T09:05:00.000Z'),
      },
      {
        userId: 'user-2',
        eventName: 'background_removal_failed',
        occurredAt: new Date('2026-08-12T09:10:00.000Z'),
      },
    ],
    wearLogs: [
      {
        userId: 'user-1',
        wornAt: new Date('2026-08-12T07:30:00.000Z'),
      },
    ],
    savedOutfitUserIds: ['user-1'],
    lastActivityByUserId: {
      'user-1': new Date('2026-08-12T08:10:00.000Z'),
      'user-2': new Date('2026-08-12T09:10:00.000Z'),
    },
  }
}

describe('admin analytics snapshot', () => {
  it('builds overview, activity, product, and subscription metrics', () => {
    const snapshot = buildAdminAnalyticsSnapshot(createAdminSource(), {
      preset: '30d',
      now: new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(snapshot.overview.totalUsers).toBe(3)
    expect(snapshot.overview.verifiedUsers).toBe(2)
    expect(snapshot.activity.dau).toBe(2)
    expect(snapshot.activity.wau).toBe(2)
    expect(snapshot.activity.mau).toBe(2)
    expect(snapshot.activation.activatedUsers).toBe(2)
    expect(snapshot.product.totalActiveWardrobeItems).toBe(3)
    expect(snapshot.product.stylistGenerationsInRange).toBe(1)
    expect(snapshot.product.stylistFailureRate).toBe(0.5)
    expect(snapshot.product.aiAnalysisFailureRate).toBe(0.5)
    expect(snapshot.product.outfitsCreatedInRange).toBe(1)
    expect(snapshot.product.plannerSchedulesInRange).toBe(1)
    expect(snapshot.product.wearLogsInRange).toBe(1)
    expect(snapshot.subscriptions.freeUsers).toBe(1)
    expect(snapshot.subscriptions.premiumUsers).toBe(1)
    expect(snapshot.subscriptions.trialUsers).toBe(1)
  })

  it('builds funnel, retention states, insights, and safe user rows', () => {
    const snapshot = buildAdminAnalyticsSnapshot(createAdminSource(), {
      preset: '30d',
      now: new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(snapshot.funnel.stages.map((stage) => stage.count)).toEqual([
      3, 2, 2, 2, 1,
    ])
    expect(snapshot.retention.d1.state).toBe('ready')
    expect(snapshot.retention.d7.state).toBe('not_enough_data')
    expect(snapshot.retention.d30.state).toBe('not_enough_data')
    expect(snapshot.fashionInsights.categories[0]).toEqual({
      key: 'bottoms',
      count: 1,
    })
    expect(snapshot.fashionInsights.subtypes).toEqual(
      expect.arrayContaining([{ key: 'shirt', count: 1 }]),
    )
    expect(snapshot.health.stylistSuccessRate).toBe(0.5)
    expect(snapshot.users[0]).toEqual(
      expect.objectContaining({
        email: expect.any(String),
        registeredAt: expect.any(String),
        isVerified: expect.any(Boolean),
        plan: expect.any(String),
        wardrobeItemCount: expect.any(Number),
        stylistGenerationCount: expect.any(Number),
      }),
    )
    expect(snapshot.users[0]).toHaveProperty('lastMeaningfulActivityAt')
    expect(Object.keys(snapshot.users[0] ?? {})).not.toContain('password')
    expect(Object.keys(snapshot.users[0] ?? {})).not.toContain(
      'imageStorageKey',
    )
  })

  it('handles early-stage and empty analytics states without misleading zeros', () => {
    const emptySnapshot = buildAdminAnalyticsSnapshot(
      {
        users: [],
        subscriptions: [],
        wardrobeItems: [],
        outfitRequests: [],
        analyticsEvents: [],
        wearLogs: [],
        savedOutfitUserIds: [],
        lastActivityByUserId: {},
      },
      {
        preset: 'today',
        now: new Date('2026-08-12T12:00:00.000Z'),
      },
    )

    expect(emptySnapshot.overview.totalUsers).toBe(0)
    expect(emptySnapshot.activity.dauMauRatio).toBeNull()
    expect(emptySnapshot.retention.d1.state).toBe('not_enough_data')
    expect(emptySnapshot.fashionInsights.categories).toEqual([])
    expect(emptySnapshot.users).toEqual([])
  })

  it('resolves admin date presets and protects the route with admin-only access', () => {
    const todayRange = getAdminRange(
      'today',
      new Date('2026-08-12T12:00:00.000Z'),
    )

    expect(resolveAdminRangePreset('90d')).toBe('90d')
    expect(resolveAdminRangePreset('nope')).toBe('30d')
    expect(todayRange.days).toBe(1)
    expect(adminPageSource).toContain('canAccessAdmin')
    expect(adminPageSource).toContain('notFound()')
    expect(adminPageSource).toContain('resolveAdminRangePreset')
    expect(adminPageSource).toContain('getAdminAnalyticsSnapshot')
  })
})
