const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Route ids are UUIDs; anything else is a 404, not a database error. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}
