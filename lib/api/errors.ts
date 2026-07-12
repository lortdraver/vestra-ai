export type ApiErrorCode =
  | 'unauthorized'
  | 'missing_required_fields'
  | 'invalid_category'
  | 'missing_image'
  | 'invalid_image_type'
  | 'image_too_large'
  | 'background_removal_not_configured'
  | 'storage_not_configured'
  | 'storage_write_failed'
  | 'database_schema_mismatch'
  | 'database_write_failed'
  | 'upload_failed'
  | 'not_found'
  | 'update_failed'
  | 'delete_failed'
  | 'analysis_failed'
  | 'analysis_not_ready'
  | 'invalid_corrections'
  | 'wear_log_target_required'
  | 'wear_log_invalid_date'
  | 'wear_log_duplicate'
  | 'wear_log_item_not_available'
  | 'wear_log_outfit_not_available'
  | 'wear_log_write_failed'

export function apiError(error: ApiErrorCode, status: number, detail?: string) {
  return Response.json({ error, detail }, { status })
}

export function getPostgresErrorCode(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code
  }

  return null
}

export function isDatabaseSchemaError(error: unknown) {
  return ['42P01', '42703'].includes(getPostgresErrorCode(error) ?? '')
}

export function getDatabaseErrorDetail(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const details = {
    code: 'code' in error && typeof error.code === 'string' ? error.code : null,
    message:
      'message' in error && typeof error.message === 'string'
        ? error.message
        : null,
    detail:
      'detail' in error && typeof error.detail === 'string'
        ? error.detail
        : null,
    table:
      'table' in error && typeof error.table === 'string' ? error.table : null,
    column:
      'column' in error && typeof error.column === 'string'
        ? error.column
        : null,
    constraint:
      'constraint' in error && typeof error.constraint === 'string'
        ? error.constraint
        : null,
  }

  return Object.entries(details)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

export function logDev(message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[dev] ${message}`, context ?? {})
  }
}
