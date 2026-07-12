import { and, eq, ne } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { outfit, outfitItem, wardrobeItem } from '@/lib/db/schema'
import { toOutfitDto } from '@/lib/stylist/serialize'
import { toStylistWardrobeItem } from '@/lib/stylist/wardrobe'

const replaceItemSchema = z.object({
  outfitId: z.string().uuid(),
  wardrobeItemId: z.string().uuid(),
})

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return apiError('unauthorized', 401)

  const parsed = replaceItemSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_replace_request' },
      { status: 400 },
    )
  }

  const [ownedOutfit] = await db
    .select()
    .from(outfit)
    .where(and(eq(outfit.id, parsed.data.outfitId), eq(outfit.userId, userId)))
    .limit(1)
  if (!ownedOutfit) return apiError('not_found', 404)

  const currentItems = await db
    .select()
    .from(outfitItem)
    .where(
      and(
        eq(outfitItem.outfitId, ownedOutfit.id),
        eq(outfitItem.userId, userId),
      ),
    )
  const currentEntry = currentItems.find(
    (item) => item.wardrobeItemId === parsed.data.wardrobeItemId,
  )
  if (!currentEntry) return apiError('not_found', 404)

  const [currentWardrobeItem] = await db
    .select()
    .from(wardrobeItem)
    .where(
      and(
        eq(wardrobeItem.id, parsed.data.wardrobeItemId),
        eq(wardrobeItem.userId, userId),
      ),
    )
    .limit(1)
  if (!currentWardrobeItem) return apiError('not_found', 404)

  const [replacement] = await db
    .select()
    .from(wardrobeItem)
    .where(
      and(
        eq(wardrobeItem.userId, userId),
        eq(wardrobeItem.imageDeletionStatus, 'active'),
        eq(wardrobeItem.category, currentWardrobeItem.category),
        ne(wardrobeItem.id, currentWardrobeItem.id),
      ),
    )
    .limit(1)

  if (!replacement) {
    return NextResponse.json(
      { error: 'insufficient_alternatives' },
      { status: 422 },
    )
  }

  await db
    .update(outfitItem)
    .set({
      wardrobeItemId: replacement.id,
      explanation: `Replaced with ${replacement.name} for the same ${replacement.category} role.`,
    })
    .where(eq(outfitItem.id, currentEntry.id))

  const updatedItems = await db
    .select()
    .from(outfitItem)
    .where(
      and(
        eq(outfitItem.outfitId, ownedOutfit.id),
        eq(outfitItem.userId, userId),
      ),
    )
  const wardrobeRows = await db
    .select()
    .from(wardrobeItem)
    .where(and(eq(wardrobeItem.userId, userId)))
  const wardrobeById = new Map(
    wardrobeRows.map((item) => [item.id, toStylistWardrobeItem(item)]),
  )

  return NextResponse.json({
    outfit: toOutfitDto(ownedOutfit, updatedItems, wardrobeById),
  })
}
