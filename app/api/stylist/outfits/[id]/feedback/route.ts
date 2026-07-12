import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { outfit, outfitFeedback } from '@/lib/db/schema'

const feedbackSchema = z.object({
  rating: z.enum(['1', '2', '3', '4', '5']),
  comment: z.string().trim().max(500).optional().default(''),
})

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<unknown> },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = (await params) as { id: string }
  const parsed = feedbackSchema.safeParse(
    await request.json().catch(() => ({})),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const [existing] = await db
    .select({ id: outfit.id })
    .from(outfit)
    .where(and(eq(outfit.id, id), eq(outfit.userId, userId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const [feedback] = await db
    .insert(outfitFeedback)
    .values({
      userId,
      outfitId: id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    })
    .returning()

  return NextResponse.json({ feedback })
}
