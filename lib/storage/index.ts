import { LocalObjectStorage } from './local'
import { R2ObjectStorage } from './r2'
import type { ObjectStorage } from './types'

export function getObjectStorage(): ObjectStorage {
  const driver =
    process.env.STORAGE_DRIVER ??
    (process.env.NODE_ENV === 'production' ? 'unconfigured' : 'local')

  if (driver === 'local') {
    return new LocalObjectStorage()
  }

  if (driver === 'r2') {
    return new R2ObjectStorage()
  }

  throw new Error(`Unsupported storage driver: ${driver}`)
}
