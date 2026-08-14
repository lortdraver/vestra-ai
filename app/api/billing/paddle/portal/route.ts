import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createPaddlePortalSession, PaddleApiError } from '@/lib/billing'
import { db } from '@/lib/db'
import { subscription } from '@/lib/db/schema'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [row] = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.userId, session.user.id),
        eq(subscription.providerKey, 'paddle'),
      ),
    )
    .orderBy(desc(subscription.updatedAt))
    .limit(1)

  if (!row?.providerCustomerId) {
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
    return NextResponse.json(portal)
  } catch (error) {
    if (error instanceof PaddleApiError) {
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
