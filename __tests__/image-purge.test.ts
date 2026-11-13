import { describe, expect, it, vi } from 'vitest'
import {
  purgePendingImageDeletions,
  type ImagePurgeDeps,
} from '@/lib/wardrobe/image-purge'

function makeDeps(overrides: Partial<ImagePurgeDeps> = {}) {
  const marks: Array<[string, string]> = []
  const deleted: string[] = []
  const deps: ImagePurgeDeps = {
    loadPending: async () => [
      { id: 'q1', storageKey: 'wardrobe/u/original/a.jpg' },
      { id: 'q2', storageKey: 'wardrobe/u/thumb/b.webp' },
    ],
    isStillReferenced: async () => false,
    deleteObject: async (key) => {
      deleted.push(key)
    },
    markProcessed: async (id, status) => {
      marks.push([id, status])
    },
    ...overrides,
  }
  return { deps, marks, deleted }
}

describe('image deletion queue purge', () => {
  it('deletes queued objects and marks them processed', async () => {
    const { deps, marks, deleted } = makeDeps()

    const summary = await purgePendingImageDeletions(deps)

    expect(summary).toMatchObject({ scanned: 2, deleted: 2, failed: 0 })
    expect(deleted).toHaveLength(2)
    expect(marks).toEqual([
      ['q1', 'processed'],
      ['q2', 'processed'],
    ])
  })

  it('never deletes an object still used by an active item', async () => {
    const { deps, deleted, marks } = makeDeps({
      isStillReferenced: async (key) => key.includes('original'),
    })

    const summary = await purgePendingImageDeletions(deps)

    expect(summary.skippedReferenced).toBe(1)
    expect(deleted).toEqual(['wardrobe/u/thumb/b.webp'])
    expect(marks).toContainEqual(['q1', 'skipped'])
  })

  it('changes nothing in dry-run mode', async () => {
    const deleteObject = vi.fn()
    const markProcessed = vi.fn()
    const { deps } = makeDeps({ deleteObject, markProcessed })

    const summary = await purgePendingImageDeletions(deps, { dryRun: true })

    expect(summary).toMatchObject({ deleted: 2, dryRun: true })
    expect(deleteObject).not.toHaveBeenCalled()
    expect(markProcessed).not.toHaveBeenCalled()
  })

  it('records failures without stopping the batch', async () => {
    const { deps, marks } = makeDeps({
      deleteObject: async (key) => {
        if (key.includes('original')) throw new Error('R2 down')
      },
    })

    const summary = await purgePendingImageDeletions(deps)

    expect(summary).toMatchObject({ deleted: 1, failed: 1 })
    expect(marks).toContainEqual(['q1', 'failed'])
  })
})
