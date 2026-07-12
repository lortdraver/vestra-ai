import { and, eq, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, wardrobeItem } from '@/lib/db/schema'
import { canAccessAdmin } from '@/lib/roles'
import { getObjectStorage } from '@/lib/storage'
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
  ]
  const filters = canAccessAdmin(currentUser.role)
    ? [or(...ownershipFilters)]
    : [eq(wardrobeItem.userId, currentUser.id), or(...ownershipFilters)]

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

  const object = await getObjectStorage().getObject(storageKey)
  return new NextResponse(object.body, {
    headers: {
      'Cache-Control': 'private, max-age=300',
      'Content-Length': String(object.size),
      'Content-Type': object.contentType,
    },
  })
}
