import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { apiError, logDev, type ApiErrorCode } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/server'
import { checkRateLimit, securityLimits } from '@/lib/security/rate-limit'
import {
  createWearLogForUser,
  listWearLogsForUser,
  WearLogError,
} from '@/lib/wear/server'
import { createWearLogSchema, parseOptionalDate } from '@/lib/wear/validation'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

async function localizedWearError(code: ApiErrorCode, status: number) {
  const dictionary = await getDictionary()
  const messages = dictionary.wear.errors as Record<string, string>
  return NextResponse.json(
    { error: code, message: messages[code] ?? code },
    { status },
  )
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return localizedWearError('unauthorized', 401)

  const rateLimit = checkRateLimit({
    key: `wear-log:${userId}`,
    ...securityLimits.upload,
  })
  if (!rateLimit.allowed) {
    return localizedWearError('wear_log_duplicate', 429)
  }

  const body = (await request.json().catch(() => null)) as unknown
  const parsed = createWearLogSchema.safeParse(body)
  if (!parsed.success) {
    logDev('Wear log validation failed', {
      userId,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return localizedWearError('wear_log_target_required', 400)
  }

  try {
    const log = await createWearLogForUser(userId, parsed.data)
    const dictionary = await getDictionary()
    return NextResponse.json({
      wearLog: log,
      message: dictionary.wear.toast.recorded,
    })
  } catch (error) {
    if (error instanceof WearLogError) {
      const status =
        error.code === 'wear_log_target_required'
          ? 400
          : error.code === 'wear_log_outfit_not_available' ||
              error.code === 'wear_log_item_not_available'
            ? 404
            : 409
      return localizedWearError(error.code, status)
    }

    logDev('Wear log create failed', {
      userId,
      message: error instanceof Error ? error.message : 'unknown',
    })
    return localizedWearError('wear_log_write_failed', 500)
  }
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return apiError('unauthorized', 401)

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 50)
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0)
  const startDate = parseOptionalDate(url.searchParams.get('startDate'))
  const endDate = parseOptionalDate(url.searchParams.get('endDate'))
  const itemId = url.searchParams.get('itemId')
  const outfitId = url.searchParams.get('outfitId')

  const wearLogs = await listWearLogsForUser({
    userId,
    limit,
    offset,
    startDate,
    endDate,
    itemId,
    outfitId,
  })

  return NextResponse.json({ wearLogs, pagination: { limit, offset } })
}
