import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { trackServerEvent } from '@/lib/analytics/server'
import { auth } from '@/lib/auth'
import { createPaddlePortalSession, PaddleApiError } from '@/lib/billing'
import {
  getLatestPaddleSubscriptionForUser,
  markPaddleSubscriptionOrphaned,
} from '@/lib/billing/server'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const row = await getLatestPaddleSubscriptionForUser(session.user.id)

  if (!row?.providerCustomerId || !row.providerSubscriptionId) {
    if (row?.providerCustomerId && !row.providerSubscriptionId) {
      await markPaddleSubscriptionOrphaned(
        row,
        'missing_provider_subscription_id',
      )
    }
    return NextResponse.json(
      { error: 'paddle_subscription_not_found' },
      { status: 404 },
    )
  }

  try {
    const portal = await createPaddlePortalSession({
      customerId: row.providerCustomerId,
      subscriptionId: row.providerSubscriptionId,
    })
    void trackServerEvent({
      eventName: 'billing_portal_opened',
      userId: session.user.id,
      properties: {
        provider: 'paddle',
        interval: row.billingInterval ?? 'unknown',
      },
    })
    return NextResponse.json(portal)
  } catch (error) {
    if (error instanceof PaddleApiError) {
      if (error.code === 'paddle_subscription_not_found') {
        await markPaddleSubscriptionOrphaned(
          row,
          'provider_subscription_not_found',
        )
      }
      return NextResponse.json(
        { error: error.code, code: error.code },
        { status: error.status },
      )
    }
    return NextResponse.json(
      { error: 'paddle_checkout_failed', code: 'paddle_checkout_failed' },
      { status: 502 },
    )
  }
}
