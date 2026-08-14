import { NextResponse } from 'next/server'
import { PaddleConfigError } from '@/lib/billing/paddle-config'
import {
  PaddleWebhookError,
  processPaddleWebhook,
} from '@/lib/billing/paddle-webhook'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('paddle-signature')

  try {
    const result = await processPaddleWebhook(rawBody, signature)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PaddleWebhookError) {
      return NextResponse.json(
        { ok: false, code: error.code },
        { status: error.status },
      )
    }
    if (error instanceof PaddleConfigError) {
      return NextResponse.json({ ok: false, code: error.code }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, code: 'paddle_webhook_processing_failed' },
      { status: 500 },
    )
  }
}
