import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { outfit, outfitFeedback } from '@/lib/db/schema'

const feedbackSchema = z.object({
  outfitId: z.string().uuid(),
  rating: z
    .enum([
      'like',
      'dislike',
      'not_my_style',
      'too_formal',
      'too_casual',
      'colors_do_not_work',
      'do_not_like_this_item',
      'wore_similar_recently',
      'good_combination',
      'save_as_preference',
    ])
    .default('like'),
  reasonTags: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  comment: z.string().trim().max(500).default(''),
})

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return apiError('unauthorized', 401)

  const parsed = feedbackSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_feedback' }, { status: 400 })
  }

  const [ownedOutfit] = await db
    .select()
    .from(outfit)
    .where(and(eq(outfit.id, parsed.data.outfitId), eq(outfit.userId, userId)))
    .limit(1)
  if (!ownedOutfit) return apiError('not_found', 404)

  const [feedback] = await db
    .insert(outfitFeedback)
    .values({
      userId,
      outfitId: ownedOutfit.id,
      generationBatchId: ownedOutfit.generationBatchId,
      rating: parsed.data.rating,
      reasonTags: parsed.data.reasonTags,
      comment: parsed.data.comment,
    })
    .returning()

  return NextResponse.json({ feedback })
}
