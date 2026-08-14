import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { trackServerEvent } from '@/lib/analytics/server'
import { auth } from '@/lib/auth'
import { PaddleApiError, switchPaddleSubscriptionPlan } from '@/lib/billing'
import { getLatestPaddleSubscriptionForUser } from '@/lib/billing/server'

const switchSchema = z.object({
  interval: z.enum(['monthly', 'annual']),
})

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const parsed = switchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const row = await getLatestPaddleSubscriptionForUser(session.user.id)
  if (!row?.providerSubscriptionId) {
    return NextResponse.json(
      {
        error: 'paddle_subscription_not_found',
        code: 'paddle_subscription_not_found',
      },
      { status: 404 },
    )
  }
  if (row.status === 'past_due') {
    return NextResponse.json(
      {
        error: 'payment_issue_requires_portal',
        code: 'payment_issue_requires_portal',
      },
      { status: 409 },
    )
  }
  if (row.billingInterval === parsed.data.interval) {
    return NextResponse.json({ ok: true, code: 'already_current_plan' })
  }

  try {
    await switchPaddleSubscriptionPlan({
      subscriptionId: row.providerSubscriptionId,
      interval: parsed.data.interval,
    })
    void trackServerEvent({
      eventName: 'subscription_plan_change_requested',
      userId: session.user.id,
      properties: {
        provider: 'paddle',
        from: row.billingInterval ?? 'unknown',
        to: parsed.data.interval,
      },
    })
    return NextResponse.json({
      ok: true,
      status: 'pending_webhook',
      interval: parsed.data.interval,
    })
  } catch (error) {
    if (error instanceof PaddleApiError) {
      return NextResponse.json(
        { error: error.code, code: error.code },
        { status: error.status },
      )
    }
    return NextResponse.json(
      {
        error: 'paddle_subscription_action_failed',
        code: 'paddle_subscription_action_failed',
      },
      { status: 502 },
    )
  }
}
