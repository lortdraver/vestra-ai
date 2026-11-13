import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  createDatabaseImagePurgeDeps,
  purgePendingImageDeletions,
} from '@/lib/wardrobe/image-purge'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/**
 * Drains wardrobe_image_deletion_queue (deleted items, replaced images,
 * deleted accounts). Vercel Cron calls GET with `Authorization: Bearer
 * $CRON_SECRET`; any other scheduler can do the same. `?dryRun=1` reports
 * without deleting.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 })
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const limit = Number(url.searchParams.get('limit') ?? 200)

  const summary = await purgePendingImageDeletions(
    await createDatabaseImagePurgeDeps(),
    { dryRun, limit: Number.isFinite(limit) ? limit : 200 },
  )
  console.info('[image-purge] RUN_COMPLETED', summary)

  return NextResponse.json({ ok: true, ...summary })
}
