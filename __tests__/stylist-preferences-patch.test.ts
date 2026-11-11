import { describe, expect, it } from 'vitest'
import {
  stylistPreferencePatchSchema,
  stylistPreferenceSchema,
} from '@/lib/stylist/preferences'

describe('stylist preference patch', () => {
  it('only contains the fields that were sent', () => {
    const itemId = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b'
    const patch = stylistPreferencePatchSchema.parse({
      preferredWardrobeItemIds: [itemId],
    })

    expect(patch).toEqual({ preferredWardrobeItemIds: [itemId] })
  })

  it('still applies defaults when reading a full profile', () => {
    expect(stylistPreferenceSchema.parse({}).preferredStyles).toEqual([])
  })
})
