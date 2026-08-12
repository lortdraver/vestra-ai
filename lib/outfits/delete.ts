import { and, count, eq, gte } from 'drizzle-orm'
import { trackServerEvent } from '@/lib/analytics/server'
import { db } from '@/lib/db'
import { outfit, outfitPlan } from '@/lib/db/schema'

export type DeleteOutfitStage =
  | 'OUTFIT_LOADED'
  | 'PLANNER_REFERENCES_CHECKED'
  | 'DATABASE_DELETE_STARTED'
  | 'DATABASE_DELETE_COMPLETED'

export type DeleteOutfitResult = {
  ok: true
  deletedOutfitId: string
  plannerReferences: number
  wearHistoryPreserved: true
  alreadyDeleted: boolean
}

type DeleteOutfitRecord = {
  id: string
  isSaved: boolean
  isFavorite: boolean
  generationBatchId: string | null
  deletedAt: Date | null
}

type DeleteOutfitRepository = {
  getOutfit(
    userId: string,
    outfitId: string,
  ): Promise<DeleteOutfitRecord | null>
  countPlannerReferences(
    userId: string,
    outfitId: string,
    now: Date,
  ): Promise<number>
  softDeleteOutfit(
    userId: string,
    outfitId: string,
    patch: {
      deletedAt: Date
      isSaved: false
      isFavorite: false
      updatedAt: Date
    },
  ): Promise<boolean>
}

const defaultRepository: DeleteOutfitRepository = {
  async getOutfit(userId, outfitId) {
    const [row] = await db
      .select({
        id: outfit.id,
        isSaved: outfit.isSaved,
        isFavorite: outfit.isFavorite,
        generationBatchId: outfit.generationBatchId,
        deletedAt: outfit.deletedAt,
      })
      .from(outfit)
      .where(and(eq(outfit.id, outfitId), eq(outfit.userId, userId)))
      .limit(1)

    return row ?? null
  },
  async countPlannerReferences(userId, outfitId, now) {
    const [row] = await db
      .select({ value: count() })
      .from(outfitPlan)
      .where(
        and(
          eq(outfitPlan.userId, userId),
          eq(outfitPlan.outfitId, outfitId),
          eq(outfitPlan.status, 'planned'),
          gte(outfitPlan.startAt, now),
        ),
      )

    return Number(row?.value ?? 0)
  },
  async softDeleteOutfit(userId, outfitId, patch) {
    const [updated] = await db
      .update(outfit)
      .set(patch)
      .where(and(eq(outfit.id, outfitId), eq(outfit.userId, userId)))
      .returning({ id: outfit.id })

    return Boolean(updated)
  },
}

export class DeleteOutfitError extends Error {
  constructor(
    public code: 'not_found' | 'planner_confirmation_required',
    public plannerReferences = 0,
  ) {
    super(code)
  }
}

export async function deleteOutfitForUser(
  userId: string,
  outfitId: string,
  input?: {
    confirmPlannerPreservation?: boolean
    now?: Date
    onStage?: (
      stage: DeleteOutfitStage,
      context: Record<string, unknown>,
    ) => void
    repository?: DeleteOutfitRepository
  },
): Promise<DeleteOutfitResult> {
  const repository = input?.repository ?? defaultRepository
  const now = input?.now ?? new Date()

  const ownedOutfit = await repository.getOutfit(userId, outfitId)
  input?.onStage?.('OUTFIT_LOADED', {
    outfitId,
    found: Boolean(ownedOutfit),
    alreadyDeleted: Boolean(ownedOutfit?.deletedAt),
  })

  if (!ownedOutfit) {
    throw new DeleteOutfitError('not_found')
  }

  const plannerReferences = await repository.countPlannerReferences(
    userId,
    outfitId,
    now,
  )
  input?.onStage?.('PLANNER_REFERENCES_CHECKED', {
    outfitId,
    plannerReferences,
  })

  if (
    plannerReferences > 0 &&
    !ownedOutfit.deletedAt &&
    !input?.confirmPlannerPreservation
  ) {
    throw new DeleteOutfitError(
      'planner_confirmation_required',
      plannerReferences,
    )
  }

  if (ownedOutfit.deletedAt) {
    return {
      ok: true,
      deletedOutfitId: outfitId,
      plannerReferences,
      wearHistoryPreserved: true,
      alreadyDeleted: true,
    }
  }

  input?.onStage?.('DATABASE_DELETE_STARTED', { outfitId })
  const deleted = await repository.softDeleteOutfit(userId, outfitId, {
    deletedAt: now,
    isSaved: false,
    isFavorite: false,
    updatedAt: now,
  })
  input?.onStage?.('DATABASE_DELETE_COMPLETED', { outfitId, deleted })

  if (!deleted) {
    throw new DeleteOutfitError('not_found')
  }

  void trackServerEvent({
    eventName: 'outfit_deleted',
    userId,
    properties: {
      plannerReferences,
      wasSaved: ownedOutfit.isSaved,
      wasFavorite: ownedOutfit.isFavorite,
      hadGenerationBatch: Boolean(ownedOutfit.generationBatchId),
    },
    dedupeKey: `outfit-deleted:${outfitId}`,
  })

  return {
    ok: true,
    deletedOutfitId: outfitId,
    plannerReferences,
    wearHistoryPreserved: true,
    alreadyDeleted: false,
  }
}
