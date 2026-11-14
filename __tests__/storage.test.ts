import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalObjectStorage } from '@/lib/storage/local'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('storage abstraction', () => {
  it('refuses local object storage in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    // CI exports a localhost app URL, which the guard treats as local dev.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vestraapp.uk')
    vi.stubEnv('BETTER_AUTH_URL', 'https://vestraapp.uk')

    await expect(
      new LocalObjectStorage().putWardrobeImage({
        userId: 'user_1',
        file: new File(['image'], 'item.webp', { type: 'image/webp' }),
      }),
    ).rejects.toThrow('Local storage is not allowed in production')
  })
})
