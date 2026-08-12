import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dictionaries } from '@/lib/i18n/dictionaries'
import {
  getOutfitDeleteScope,
  removeOutfitFromCollection,
} from '@/lib/outfits/client'
import type { OutfitDto } from '@/lib/stylist'

const outfitsPageSource = readFileSync(
  join(process.cwd(), 'components/outfits/outfits-page-client.tsx'),
  'utf8',
)
const stylistPageSource = readFileSync(
  join(process.cwd(), 'components/stylist/stylist-page-client.tsx'),
  'utf8',
)
const outfitsRouteSource = readFileSync(
  join(process.cwd(), 'app/api/stylist/outfits/[id]/route.ts'),
  'utf8',
)
const outfitsListRouteSource = readFileSync(
  join(process.cwd(), 'app/api/stylist/outfits/route.ts'),
  'utf8',
)

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

const outfitFixture: OutfitDto = {
  id: 'outfit-1',
  title: 'Test outfit',
  occasion: 'work',
  overallExplanation: 'A complete outfit.',
  confidenceScore: 0.8,
  alternativeSuggestions: [],
  missingItems: [],
  isSaved: false,
  isFavorite: false,
  generationBatchId: null,
  styleDirection: 'classic',
  seasonLabel: 'spring',
  formalityLabel: 'business',
  items: [],
  createdAt: '2026-08-12T12:00:00.000Z',
}

describe('outfit deletion helpers', () => {
  it('removes only the deleted outfit from the current collections', () => {
    expect(
      removeOutfitFromCollection(
        [outfitFixture, { ...outfitFixture, id: 'outfit-2' }],
        'outfit-1',
      ).map((outfit) => outfit.id),
    ).toEqual(['outfit-2'])
  })

  it('treats saved outfits as the saved deletion scope', () => {
    expect(getOutfitDeleteScope({ view: 'saved', isSaved: true })).toBe('saved')
    expect(getOutfitDeleteScope({ view: 'generated', isSaved: true })).toBe(
      'saved',
    )
    expect(getOutfitDeleteScope({ view: 'history', isSaved: false })).toBe(
      'history',
    )
  })
})

describe('outfit deletion service', () => {
  async function loadDeleteModule(trackServerEvent = vi.fn()) {
    vi.doMock('@/lib/analytics/server', () => ({ trackServerEvent }))
    vi.doMock('@/lib/db', () => ({ db: {} }))
    vi.doMock('@/lib/db/schema', () => ({ outfit: {}, outfitPlan: {} }))
    return import('@/lib/outfits/delete')
  }

  it('soft deletes an owned generated outfit and preserves wear history', async () => {
    const trackServerEvent = vi.fn()
    const { deleteOutfitForUser } = await loadDeleteModule(trackServerEvent)
    const softDeleteOutfit = vi.fn().mockResolvedValue(true)

    const result = await deleteOutfitForUser('user-1', 'outfit-1', {
      repository: {
        getOutfit: vi.fn().mockResolvedValue({
          id: 'outfit-1',
          isSaved: false,
          isFavorite: false,
          generationBatchId: 'batch-1',
          deletedAt: null,
        }),
        countPlannerReferences: vi.fn().mockResolvedValue(0),
        softDeleteOutfit,
      },
      now: new Date('2026-08-12T10:00:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: true,
      deletedOutfitId: 'outfit-1',
      plannerReferences: 0,
      wearHistoryPreserved: true,
      alreadyDeleted: false,
    })
    expect(softDeleteOutfit).toHaveBeenCalledWith(
      'user-1',
      'outfit-1',
      expect.objectContaining({
        isSaved: false,
        isFavorite: false,
        deletedAt: new Date('2026-08-12T10:00:00.000Z'),
      }),
    )
    expect(trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'outfit_deleted',
        userId: 'user-1',
        dedupeKey: 'outfit-deleted:outfit-1',
      }),
    )
  })

  it('clears saved state when deleting a saved outfit', async () => {
    const { deleteOutfitForUser } = await loadDeleteModule()
    const softDeleteOutfit = vi.fn().mockResolvedValue(true)

    await deleteOutfitForUser('user-1', 'outfit-1', {
      repository: {
        getOutfit: vi.fn().mockResolvedValue({
          id: 'outfit-1',
          isSaved: true,
          isFavorite: true,
          generationBatchId: null,
          deletedAt: null,
        }),
        countPlannerReferences: vi.fn().mockResolvedValue(0),
        softDeleteOutfit,
      },
    })

    expect(softDeleteOutfit).toHaveBeenCalledWith(
      'user-1',
      'outfit-1',
      expect.objectContaining({
        isSaved: false,
        isFavorite: false,
      }),
    )
  })

  it('rejects deleting an outfit that does not belong to the user', async () => {
    const { DeleteOutfitError, deleteOutfitForUser } = await loadDeleteModule()

    await expect(
      deleteOutfitForUser('user-1', 'outfit-1', {
        repository: {
          getOutfit: vi.fn().mockResolvedValue(null),
          countPlannerReferences: vi.fn(),
          softDeleteOutfit: vi.fn(),
        },
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'not_found' }))

    expect(DeleteOutfitError).toBeDefined()
  })

  it('requires explicit confirmation when the outfit is still scheduled', async () => {
    const { deleteOutfitForUser } = await loadDeleteModule()
    const softDeleteOutfit = vi.fn().mockResolvedValue(true)

    await expect(
      deleteOutfitForUser('user-1', 'outfit-1', {
        repository: {
          getOutfit: vi.fn().mockResolvedValue({
            id: 'outfit-1',
            isSaved: false,
            isFavorite: false,
            generationBatchId: null,
            deletedAt: null,
          }),
          countPlannerReferences: vi.fn().mockResolvedValue(2),
          softDeleteOutfit,
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'planner_confirmation_required',
        plannerReferences: 2,
      }),
    )

    expect(softDeleteOutfit).not.toHaveBeenCalled()
  })

  it('allows planner-linked deletion after explicit confirmation', async () => {
    const { deleteOutfitForUser } = await loadDeleteModule()
    const softDeleteOutfit = vi.fn().mockResolvedValue(true)

    const result = await deleteOutfitForUser('user-1', 'outfit-1', {
      confirmPlannerPreservation: true,
      repository: {
        getOutfit: vi.fn().mockResolvedValue({
          id: 'outfit-1',
          isSaved: false,
          isFavorite: false,
          generationBatchId: null,
          deletedAt: null,
        }),
        countPlannerReferences: vi.fn().mockResolvedValue(1),
        softDeleteOutfit,
      },
    })

    expect(result.plannerReferences).toBe(1)
    expect(softDeleteOutfit).toHaveBeenCalledOnce()
  })

  it('keeps repeated delete idempotent and emits analytics only once', async () => {
    const trackServerEvent = vi.fn()
    const { deleteOutfitForUser } = await loadDeleteModule(trackServerEvent)
    const softDeleteOutfit = vi.fn().mockResolvedValue(true)
    const repository = {
      getOutfit: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'outfit-1',
          isSaved: false,
          isFavorite: false,
          generationBatchId: null,
          deletedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'outfit-1',
          isSaved: false,
          isFavorite: false,
          generationBatchId: null,
          deletedAt: new Date('2026-08-12T09:00:00.000Z'),
        }),
      countPlannerReferences: vi.fn().mockResolvedValue(0),
      softDeleteOutfit,
    }

    await deleteOutfitForUser('user-1', 'outfit-1', { repository })
    const second = await deleteOutfitForUser('user-1', 'outfit-1', {
      repository,
    })

    expect(second.alreadyDeleted).toBe(true)
    expect(softDeleteOutfit).toHaveBeenCalledOnce()
    expect(trackServerEvent).toHaveBeenCalledOnce()
  })
})

describe('outfit deletion UI and localization contracts', () => {
  it('exposes delete copy in Azerbaijani, English, and Russian', () => {
    for (const locale of ['az', 'en', 'ru'] as const) {
      expect(dictionaries[locale].outfits.actions.deleteHistory).toBeTruthy()
      expect(dictionaries[locale].outfits.actions.deleteSaved).toBeTruthy()
      expect(dictionaries[locale].outfits.deletion.title).toBeTruthy()
      expect(dictionaries[locale].outfits.deletion.error).toBeTruthy()
    }
  })

  it('keeps delete controls available in both saved outfits and stylist history UI', () => {
    expect(outfitsPageSource).toContain("requestDelete(outfit, 'saved')")
    expect(outfitsPageSource).toContain("requestDelete(outfit, 'history')")
    expect(outfitsPageSource).toContain('OutfitDeleteDialog')
    expect(stylistPageSource).toContain("requestDelete(candidate, 'generated')")
    expect(stylistPageSource).toContain("requestDelete(outfit, 'saved')")
    expect(stylistPageSource).toContain("requestDelete(outfit, 'history')")
    expect(stylistPageSource).toContain('OutfitDeleteDialog')
  })

  it('keeps deleted outfits out of the normal outfits API queries after refresh', () => {
    expect(outfitsListRouteSource).toContain('isNull(outfit.deletedAt)')
    expect(outfitsRouteSource).toContain('outfit_has_planner_references')
    expect(outfitsRouteSource).toContain('confirmPlannerPreservation')
  })
})
