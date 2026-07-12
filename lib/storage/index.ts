import { LocalObjectStorage } from './local'
import type { ObjectStorage } from './types'

export function getObjectStorage(): ObjectStorage {
  const driver = process.env.STORAGE_DRIVER ?? 'local'

  if (driver === 'local') {
    return new LocalObjectStorage()
  }

  throw new Error(`Unsupported storage driver: ${driver}`)
}
