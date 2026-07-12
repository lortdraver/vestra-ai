import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  deleteOutfitPlanForUser,
  getOutfitPlanForUser,
  OutfitPlanError,
  updateOutfitPlanForUser,
} from '@/lib/planner'
import { patchOutfitPlanSchema } from '@/lib/planner/validation'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

function plannerError(error: unknown) {
  if (error instanceof OutfitPlanError) {
    const status = error.code === 'not_found' ? 404 : 403
    return NextResponse.json({ error: error.code }, { status })
  }

  return NextResponse.json({ error: 'planner_failed' }, { status: 500 })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const plan = await getOutfitPlanForUser(userId, id)
    return NextResponse.json({ plan })
  } catch (error) {
    return plannerError(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const parsed = patchOutfitPlanSchema.safeParse(
    await request.json().catch(() => ({})),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const { id } = await params
    const plan = await updateOutfitPlanForUser(userId, id, parsed.data)
    return NextResponse.json({ plan })
  } catch (error) {
    return plannerError(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    await deleteOutfitPlanForUser(userId, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return plannerError(error)
  }
}
