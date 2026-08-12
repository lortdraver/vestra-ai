import { and, eq, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { trackServerEvent } from '@/lib/analytics/server'
import { db } from '@/lib/db'
import { outfit } from '@/lib/db/schema'
import { DeleteOutfitError, deleteOutfitForUser } from '@/lib/outfits/delete'

const patchSchema = z.object({
  isSaved: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
})

const deleteSchema = z.object({
  confirmPlannerPreservation: z.boolean().optional().default(false),
})

type DeleteStage =
  | 'DELETE_REQUEST_STARTED'
  | 'AUTHENTICATED'
  | 'OUTFIT_LOADED'
  | 'PLANNER_REFERENCES_CHECKED'
  | 'DATABASE_DELETE_STARTED'
  | 'DATABASE_DELETE_COMPLETED'
  | 'SUCCESS'

function logDeleteStage(stage: DeleteStage, context?: Record<string, unknown>) {
  console.info('[outfit-delete]', stage, context ?? {})
}

function logDeleteError(stage: DeleteStage, error: unknown) {
  const sanitized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) }

  console.error('[outfit-delete]', { stage, ...sanitized })
}

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
    .where(
      and(
        eq(outfit.id, id),
        eq(outfit.userId, userId),
        isNull(outfit.deletedAt),
      ),
    )
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (parsed.data.isSaved === true) {
    void trackServerEvent({
      eventName: 'stylist_outfit_saved',
      userId,
      properties: { isFavorite: updated.isFavorite },
      dedupeKey: `outfit-saved:${updated.id}`,
    })
  }

  return NextResponse.json({ outfit: updated })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<unknown> },
) {
  let stage: DeleteStage = 'DELETE_REQUEST_STARTED'

  try {
    logDeleteStage(stage)

    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          code: 'unauthorized',
          stage,
          message: 'Authentication is required.',
        },
        { status: 401 },
      )
    }

    stage = 'AUTHENTICATED'
    const { id } = (await params) as { id: string }
    const parsed = deleteSchema.safeParse(
      await request.json().catch(() => ({})),
    )
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: 'invalid_request',
          stage,
          message: 'The delete request is invalid.',
        },
        { status: 400 },
      )
    }

    logDeleteStage(stage, {
      outfitId: id,
      confirmPlannerPreservation: parsed.data.confirmPlannerPreservation,
    })

    const result = await deleteOutfitForUser(userId, id, {
      confirmPlannerPreservation: parsed.data.confirmPlannerPreservation,
      onStage(nextStage, context) {
        stage = nextStage
        logDeleteStage(nextStage, { outfitId: id, ...context })
      },
    })

    stage = 'SUCCESS'
    logDeleteStage(stage, {
      outfitId: id,
      plannerReferences: result.plannerReferences,
      alreadyDeleted: result.alreadyDeleted,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DeleteOutfitError) {
      if (error.code === 'planner_confirmation_required') {
        return NextResponse.json(
          {
            ok: false,
            code: 'outfit_has_planner_references',
            stage,
            message:
              'This outfit is still scheduled in your planner. Confirm deletion to hide it from history while keeping the planner entries intact.',
            plannerReferences: error.plannerReferences,
            wearHistoryPreserved: true,
          },
          { status: 409 },
        )
      }

      return NextResponse.json(
        {
          ok: false,
          code: 'not_found',
          stage,
          message: 'Outfit was not found.',
        },
        { status: 404 },
      )
    }

    logDeleteError(stage, error)
    return NextResponse.json(
      {
        ok: false,
        code: 'delete_failed',
        stage,
        message: 'Unable to delete the outfit right now.',
      },
      { status: 500 },
    )
  }
}
