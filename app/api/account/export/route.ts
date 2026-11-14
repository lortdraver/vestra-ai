import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'

/**
 * GDPR data export: everything Vestra keeps about the signed-in user, as one
 * JSON download. Secrets (password hashes, session tokens) are left out;
 * photos are listed by their links, which only work for the signed-in owner.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const [
    [profile],
    wardrobe,
    outfits,
    outfitItems,
    outfitFeedback,
    outfitPlans,
    wearLogs,
    preferences,
    subscriptions,
  ] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        emailVerified: schema.user.emailVerified,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1),
    db
      .select()
      .from(schema.wardrobeItem)
      .where(eq(schema.wardrobeItem.userId, userId)),
    db.select().from(schema.outfit).where(eq(schema.outfit.userId, userId)),
    db
      .select()
      .from(schema.outfitItem)
      .where(eq(schema.outfitItem.userId, userId)),
    db
      .select()
      .from(schema.outfitFeedback)
      .where(eq(schema.outfitFeedback.userId, userId)),
    db
      .select()
      .from(schema.outfitPlan)
      .where(eq(schema.outfitPlan.userId, userId)),
    db.select().from(schema.wearLog).where(eq(schema.wearLog.userId, userId)),
    db
      .select()
      .from(schema.stylistPreferenceProfile)
      .where(eq(schema.stylistPreferenceProfile.userId, userId)),
    db
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.userId, userId)),
  ])

  const wearLogIds = wearLogs.map((log) => log.id)
  const wearLogItems =
    wearLogIds.length > 0
      ? await db
          .select()
          .from(schema.wearLogItem)
          .where(inArray(schema.wearLogItem.wearLogId, wearLogIds))
      : []

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile,
      wardrobe,
      outfits,
      outfitItems,
      outfitFeedback,
      outfitPlans,
      wearLogs,
      wearLogItems,
      stylistPreferences: preferences,
      subscriptions,
    },
    null,
    2,
  )
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="vestra-data-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
