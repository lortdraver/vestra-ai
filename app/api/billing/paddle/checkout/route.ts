import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { trackServerEvent } from '@/lib/analytics/server'
import {
  createPaddleCheckoutSession,
  getPaddleDiagnostics,
  getPaddlePublicConfig,
  PaddleConfigError,
} from '@/lib/billing'
import { auth } from '@/lib/auth'

const checkoutSchema = z.object({
  interval: z.enum(['monthly', 'annual']),
})

export async function POST(request: Request) {
  console.info('[paddle] CHECKOUT_STARTED', getPaddleDiagnostics())
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const parsed = checkoutSchema.safeParse(
    await request.json().catch(() => ({})),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const publicConfig = getPaddlePublicConfig()
    if (!publicConfig.clientToken) {
      return NextResponse.json(
        { error: 'paddle_not_configured', code: 'paddle_not_configured' },
        { status: 503 },
      )
    }

    const checkout = createPaddleCheckoutSession({
      userId: session.user.id,
      email: session.user.email,
      interval: parsed.data.interval,
    })
    void trackServerEvent({
      eventName: 'checkout_started',
      userId: session.user.id,
      properties: { provider: 'paddle', interval: parsed.data.interval },
    })

    return NextResponse.json({
      provider: 'paddle',
      environment: publicConfig.clientEnvironment,
      clientToken: publicConfig.clientToken,
      priceId: checkout.priceId,
      interval: checkout.interval,
      customer: checkout.customer,
      customData: checkout.customData,
    })
  } catch (error) {
    if (error instanceof PaddleConfigError) {
      return NextResponse.json(
        { error: error.code, code: error.code },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: 'paddle_checkout_failed', code: 'paddle_checkout_failed' },
      { status: 502 },
    )
  }
}
