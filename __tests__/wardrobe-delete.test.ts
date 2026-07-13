import { describe, expect, it } from 'vitest'
import {
  getDeleteErrorMessage,
  getWardrobeImageStorageKeys,
  isWardrobeDeleteSuccessResponse,
  toStorageCleanupStatus,
  withoutWardrobeItemId,
} from '@/lib/wardrobe/delete'

describe('wardrobe delete helpers', () => {
  it('collects unique storage keys for successful delete cleanup', () => {
    expect(
      getWardrobeImageStorageKeys({
        imageStorageKey: 'users/1/processed.webp',
        originalImageStorageKey: 'users/1/original.webp',
        processedImageStorageKey: 'users/1/processed.webp',
      }),
    ).toEqual(['users/1/processed.webp', 'users/1/original.webp'])
  })

  it('returns no storage keys for missing images or repeated delete records', () => {
    expect(getWardrobeImageStorageKeys(null)).toEqual([])
    expect(
      getWardrobeImageStorageKeys({
        imageStorageKey: '',
        originalImageStorageKey: null,
        processedImageStorageKey: undefined,
      }),
    ).toEqual([])
  })

  it('removes deleted items from stylist preference item ids', () => {
    expect(
      withoutWardrobeItemId(['top-1', 'shoe-1', 'top-1'], 'top-1'),
    ).toEqual(['shoe-1'])
  })

  it('keeps preference ids unchanged when the deleted item is absent', () => {
    expect(withoutWardrobeItemId(['top-1', 'shoe-1'], 'bottom-1')).toEqual([
      'top-1',
      'shoe-1',
    ])
  })

  it('marks cleanup completed when storage deletion succeeds or object is missing', () => {
    expect(toStorageCleanupStatus(false)).toBe('completed')
  })

  it('marks cleanup queued when R2 deletion fails temporarily', () => {
    expect(toStorageCleanupStatus(true)).toBe('queued')
  })

  it('normalizes delete errors for structured API responses', () => {
    expect(getDeleteErrorMessage(new Error('database constraint failed'))).toBe(
      'database constraint failed',
    )
    expect(getDeleteErrorMessage('storage unavailable')).toBe(
      'storage unavailable',
    )
  })

  it('accepts frontend delete success state for the deleted card only', () => {
    expect(
      isWardrobeDeleteSuccessResponse(
        {
          ok: true,
          deletedItemId: 'item-1',
          storageCleanup: 'completed',
        },
        'item-1',
      ),
    ).toBe(true)
  })

  it('rejects frontend delete failure or mismatched item state', () => {
    expect(
      isWardrobeDeleteSuccessResponse(
        {
          ok: true,
          deletedItemId: 'other-item',
          storageCleanup: 'completed',
        },
        'item-1',
      ),
    ).toBe(false)
    expect(
      isWardrobeDeleteSuccessResponse(
        {
          ok: true,
          deletedItemId: 'item-1',
          storageCleanup: 'unknown',
        },
        'item-1',
      ),
    ).toBe(false)
  })
})
