export type StylistGenerationFailureStatus =
  'generation_failed' | 'insufficient_wardrobe'

export type StylistGenerateFailureDetails = {
  requiredCategories: string[]
  availableCategories: string[]
  missingCategories: string[]
  lockedItemIds: string[]
  eligibleItemCount: number
}

export type StylistGenerateFailurePayload = {
  status: StylistGenerationFailureStatus
  code: string
  message: string
  details: StylistGenerateFailureDetails
  retryable?: boolean
}

function cleanStringList(values: readonly unknown[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function cleanCount(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0
}

export function buildStylistGenerateFailureDetails(
  input: Partial<StylistGenerateFailureDetails> = {},
): StylistGenerateFailureDetails {
  return {
    requiredCategories: cleanStringList(input.requiredCategories),
    availableCategories: cleanStringList(input.availableCategories),
    missingCategories: cleanStringList(input.missingCategories),
    lockedItemIds: cleanStringList(input.lockedItemIds),
    eligibleItemCount: cleanCount(input.eligibleItemCount),
  }
}

export function createStylistGenerateFailurePayload(input: {
  status: StylistGenerationFailureStatus
  code: string
  message: string
  details?: Partial<StylistGenerateFailureDetails>
  retryable?: boolean
}): StylistGenerateFailurePayload {
  return {
    status: input.status,
    code: input.code,
    message: input.message,
    details: buildStylistGenerateFailureDetails(input.details),
    ...(typeof input.retryable === 'boolean'
      ? { retryable: input.retryable }
      : {}),
  }
}

export function getStylistRequestType(
  input: {
    quickRequest?: string | null
    message?: string | null
  } | null,
) {
  return (
    input?.quickRequest?.trim() ||
    (input?.message?.trim() ? 'custom' : 'unknown')
  )
}
