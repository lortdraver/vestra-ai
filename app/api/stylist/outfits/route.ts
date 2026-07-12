import { and, desc, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { outfit, outfitItem, wardrobeItem } from '@/lib/db/schema'
import { toOutfitDto } from '@/lib/stylist/serialize'
import { toStylistWardrobeItem } from '@/lib/stylist/wardrobe'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const savedOnly = url.searchParams.get('saved') === 'true'
  const outfitRows = await db
    .select()
    .from(outfit)
    .where(
      and(
        eq(outfit.userId, userId),
        savedOnly ? eq(outfit.isSaved, true) : undefined,
      ),
    )
    .orderBy(desc(outfit.createdAt))
    .limit(20)

  const outfitIds = outfitRows.map((row) => row.id)
  const itemRows =
    outfitIds.length > 0
      ? await db
          .select()
          .from(outfitItem)
          .where(
            and(
              eq(outfitItem.userId, userId),
              inArray(outfitItem.outfitId, outfitIds),
            ),
          )
      : []
  const wardrobeIds = itemRows.map((row) => row.wardrobeItemId)
  const wardrobeRows =
    wardrobeIds.length > 0
      ? await db
          .select()
          .from(wardrobeItem)
          .where(
            and(
              eq(wardrobeItem.userId, userId),
              inArray(wardrobeItem.id, wardrobeIds),
            ),
          )
      : []

  const wardrobeById = new Map(
    wardrobeRows.map((row) => [row.id, toStylistWardrobeItem(row)]),
  )

  return NextResponse.json({
    outfits: outfitRows.map((row) =>
      toOutfitDto(
        row,
        itemRows.filter((item) => item.outfitId === row.id),
        wardrobeById,
      ),
    ),
  })
}
