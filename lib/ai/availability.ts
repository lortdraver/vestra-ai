import { getClothingAnalysisProvider } from './index'
import { resolveStylistProviderConfig } from '@/lib/stylist'

export type AiAvailability = {
  /** Server-side (paid) clothing analysis can run. */
  analysis: boolean
  /** The paid AI stylist runs. When false the free rule-based stylist is used. */
  stylist: boolean
}

function isForcedOff() {
  const value = process.env.AI_FEATURES_DISABLED?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

function canBuild(factory: () => unknown) {
  try {
    factory()
    return true
  } catch {
    return false
  }
}

function isPaidStylist() {
  try {
    return resolveStylistProviderConfig().provider === 'api'
  } catch {
    return false
  }
}

/**
 * Whether the paid AI features are configured. The UI uses this to stop
 * promising features that would only fail: when AI is switched off (by
 * removing the API key or setting AI_FEATURES_DISABLED=true) the analysis and
 * stylist entry points show an honest "temporarily unavailable" state.
 */
export function getAiAvailability(): AiAvailability {
  if (isForcedOff()) return { analysis: false, stylist: false }

  return {
    analysis: canBuild(getClothingAnalysisProvider),
    stylist: isPaidStylist(),
  }
}
