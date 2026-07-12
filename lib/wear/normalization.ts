export function toIsoDate(value: unknown): string | null {
  if (value == null) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  return null
}

export function toWearCount(value: unknown): number {
  const count = Number(value ?? 0)
  return Number.isFinite(count) ? count : 0
}
