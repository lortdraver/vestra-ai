import type { StylistRequest } from './types'

const activeStylistGenerations = new Set<string>()

export function getStylistGenerationKey(
  userId: string,
  request: StylistRequest,
) {
  return JSON.stringify({
    userId,
    message: request.message,
    quickRequest: request.quickRequest ?? null,
    locale: request.locale,
    lockedItemIds: request.lockedItemIds,
    dateTime: request.dateTime ?? null,
    occasion: request.occasion ?? null,
    locationName: request.locationName ?? null,
    weatherContext: request.weatherContext ?? null,
    wearHistoryMode: request.wearHistoryMode,
  })
}

export function tryStartStylistGeneration(key: string) {
  if (activeStylistGenerations.has(key)) return false
  activeStylistGenerations.add(key)
  return true
}

export function finishStylistGeneration(key: string | null) {
  if (key) activeStylistGenerations.delete(key)
}
