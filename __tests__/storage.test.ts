import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalObjectStorage } from '@/lib/storage/local'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('storage abstraction', () => {
  it('refuses local object storage in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(
      new LocalObjectStorage().putWardrobeImage({
        userId: 'user_1',
        file: new File(['image'], 'item.webp', { type: 'image/webp' }),
      }),
    ).rejects.toThrow('Local storage is not allowed in production')
  })
})
