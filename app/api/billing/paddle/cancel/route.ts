import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { trackServerEvent } from '@/lib/analytics/server'
import { auth } from '@/lib/auth'
import { cancelPaddleSubscription, PaddleApiError } from '@/lib/billing'
import { getLatestPaddleSubscriptionForUser } from '@/lib/billing/server'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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
  if (row.cancelAtPeriodEnd) {
    return NextResponse.json({
      ok: true,
      code: 'subscription_cancel_already_scheduled',
      accessUntil: row.currentPeriodEnd,
    })
  }

  try {
    await cancelPaddleSubscription(row.providerSubscriptionId)
    void trackServerEvent({
      eventName: 'subscription_cancel_requested',
      userId: session.user.id,
      properties: {
        provider: 'paddle',
        interval: row.billingInterval ?? 'unknown',
      },
    })
    return NextResponse.json({
      ok: true,
      status: 'pending_webhook',
      accessUntil: row.currentPeriodEnd,
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
