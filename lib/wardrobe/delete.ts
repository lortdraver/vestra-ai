type WardrobeImageRecord = {
  imageStorageKey?: string | null
  originalImageStorageKey?: string | null
  processedImageStorageKey?: string | null
}

export type WardrobeStorageCleanupStatus = 'completed' | 'queued'

export function getWardrobeImageStorageKeys(
  item: WardrobeImageRecord | null | undefined,
) {
  if (!item) return []

  return [
    item.imageStorageKey,
    item.originalImageStorageKey,
    item.processedImageStorageKey,
  ].filter((key, index, keys): key is string =>
    Boolean(key && keys.indexOf(key) === index),
  )
}

export function withoutWardrobeItemId(values: string[], itemId: string) {
  return values.filter((value) => value !== itemId)
}

export function toStorageCleanupStatus(hasFailures: boolean) {
  return hasFailures ? 'queued' : 'completed'
}

export function getDeleteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function isWardrobeDeleteSuccessResponse(
  value: unknown,
  expectedItemId: string,
) {
  if (!value || typeof value !== 'object') return false

  const response = value as {
    ok?: unknown
    deletedItemId?: unknown
    storageCleanup?: unknown
  }

  return (
    response.ok === true &&
    response.deletedItemId === expectedItemId &&
    (response.storageCleanup === 'completed' ||
      response.storageCleanup === 'queued')
  )
}
