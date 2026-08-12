import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { trackServerEvent } from '@/lib/analytics/server'
import { requireVerifiedEmailSession } from '@/lib/auth-email-verification'
import { db } from '@/lib/db'
import { stylistPreferenceProfile } from '@/lib/db/schema'
import {
  stylistPreferencePatchSchema,
  stylistPreferenceSchema,
} from '@/lib/stylist/preferences'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

function serializePreference(
  row: typeof stylistPreferenceProfile.$inferSelect,
) {
  return {
    preferredStyles: row.preferredStyles,
    dislikedStyles: row.dislikedStyles,
    preferredColors: row.preferredColors,
    avoidedColors: row.avoidedColors,
    preferredFormality: row.preferredFormality,
    preferredFit: row.preferredFit,
    preferredWardrobeItemIds: row.preferredWardrobeItemIds,
    dislikedWardrobeItemIds: row.dislikedWardrobeItemIds,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return apiError('unauthorized', 401)

  const [row] = await db
    .select()
    .from(stylistPreferenceProfile)
    .where(eq(stylistPreferenceProfile.userId, userId))
    .limit(1)

  return NextResponse.json({
    preferences: row
      ? serializePreference(row)
      : { ...stylistPreferenceSchema.parse({}), updatedAt: null },
  })
}

export async function PATCH(request: Request) {
  const verifiedSession = await requireVerifiedEmailSession()
  if (!verifiedSession.ok) return verifiedSession.response
  const userId = verifiedSession.userId

  const body = await request.json().catch(() => null)
  const parsed = stylistPreferencePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_preferences' }, { status: 400 })
  }

  const [row] = await db
    .insert(stylistPreferenceProfile)
    .values({ userId, ...parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: stylistPreferenceProfile.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning()

  void trackServerEvent({
    eventName: 'stylist_preferences_updated',
    userId,
    properties: {
      preferredStyleCount: row.preferredStyles.length,
      preferredColorCount: row.preferredColors.length,
    },
    dedupeKey: `stylist-preferences:${userId}:${row.updatedAt.toISOString()}`,
  })

  return NextResponse.json({ preferences: serializePreference(row) })
}
