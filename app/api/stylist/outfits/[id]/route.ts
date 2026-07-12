import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { outfit } from '@/lib/db/schema'

const patchSchema = z.object({
  isSaved: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
})

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<unknown> },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = (await params) as { id: string }
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const [updated] = await db
    .update(outfit)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(outfit.id, id), eq(outfit.userId, userId)))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ outfit: updated })
}
