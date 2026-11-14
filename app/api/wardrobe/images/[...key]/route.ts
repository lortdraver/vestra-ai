import { and, eq, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, wardrobeItem } from '@/lib/db/schema'
import { getObjectStorage } from '@/lib/storage'
import { R2ObjectStorage } from '@/lib/storage/r2'
import { sanitizeStorageKey } from '@/lib/storage/r2'

async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const [currentUser] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  return currentUser ?? null
}

async function canAccessImage(storageKey: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return false

  const ownershipFilters = [
    eq(wardrobeItem.imageStorageKey, storageKey),
    eq(wardrobeItem.originalImageStorageKey, storageKey),
    eq(wardrobeItem.processedImageStorageKey, storageKey),
    eq(wardrobeItem.thumbnailImageStorageKey, storageKey),
  ]
  // Private photos are only ever served to their owner, admins included.
  const filters = [
    eq(wardrobeItem.userId, currentUser.id),
    or(...ownershipFilters),
  ]

  const [item] = await db
    .select({ id: wardrobeItem.id })
    .from(wardrobeItem)
    .where(and(...filters))
    .limit(1)

  return Boolean(item)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params
  const storageKey = sanitizeStorageKey(key.join('/'))

  if (!(await canAccessImage(storageKey))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const storage = getObjectStorage()
  if (storage instanceof R2ObjectStorage) {
    // Send the browser straight to R2 with a short-lived signed link instead
    // of streaming every photo through this function.
    return NextResponse.redirect(storage.getSignedReadUrl(storageKey), {
      status: 302,
      headers: {
        'Cache-Control': 'private, max-age=3000',
        Vary: 'Cookie',
      },
    })
  }

  const object = await storage.getObject(storageKey)
  return new NextResponse(object.body, {
    headers: {
      'Cache-Control': 'private, max-age=900, stale-while-revalidate=3600',
      'Content-Length': String(object.size),
      'Content-Type': object.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      Vary: 'Cookie',
    },
  })
}
