import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  createOutfitPlanForUser,
  listOutfitPlansForUser,
  OutfitPlanError,
} from '@/lib/planner'
import {
  createOutfitPlanSchema,
  listOutfitPlansQuerySchema,
  parsePlanRange,
} from '@/lib/planner/validation'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

function plannerError(error: unknown) {
  if (error instanceof OutfitPlanError) {
    const status =
      error.code === 'duplicate_plan'
        ? 409
        : error.code === 'not_found'
          ? 404
          : 403
    return NextResponse.json({ error: error.code }, { status })
  }

  return NextResponse.json({ error: 'planner_failed' }, { status: 500 })
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const parsed = createOutfitPlanSchema.safeParse(
    await request.json().catch(() => ({})),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const plan = await createOutfitPlanForUser(userId, parsed.data)
    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    return plannerError(error)
  }
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = listOutfitPlansQuerySchema.safeParse({
    startDate: url.searchParams.get('startDate'),
    endDate: url.searchParams.get('endDate'),
    status: url.searchParams.get('status'),
    occasion: url.searchParams.get('occasion'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const range = parsePlanRange(parsed.data)
  const plans = await listOutfitPlansForUser({
    userId,
    ...range,
    status: parsed.data.status,
    occasion: parsed.data.occasion,
  })

  return NextResponse.json({ plans })
}
