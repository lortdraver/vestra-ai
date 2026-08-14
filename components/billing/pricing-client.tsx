'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PaddleBillingInterval } from '@/lib/billing'
import type { getBillingCopy } from '@/lib/billing/copy'

type PaddleCheckoutResponse = {
  environment: 'sandbox' | 'production'
  clientToken: string
  priceId: string
  interval: PaddleBillingInterval
  customer?: { email: string }
  customData: { vestraUserId: string }
  error?: string
}

declare global {
  interface Window {
    Paddle?: {
      Environment?: { set(value: 'sandbox' | 'production'): void }
      Initialize(input: { token: string }): void
      Checkout: {
        open(input: {
          items: Array<{ priceId: string; quantity: number }>
          customer?: { email: string }
          customData?: Record<string, string>
          settings?: { displayMode?: 'overlay'; theme?: 'light' }
        }): void
      }
    }
    __vestraPaddleToken?: string
  }
}

let paddleScriptPromise: Promise<void> | null = null

function loadPaddleScript() {
  if (typeof window === 'undefined') return Promise.reject()
  if (window.Paddle) return Promise.resolve()
  if (paddleScriptPromise) return paddleScriptPromise

  paddleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-vestra-paddle]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.async = true
    script.dataset.vestraPaddle = 'true'
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })

  return paddleScriptPromise
}

async function initializePaddle(response: PaddleCheckoutResponse) {
  await loadPaddleScript()
  if (!window.Paddle) throw new Error('paddle_unavailable')
  window.Paddle.Environment?.set(response.environment)
  if (window.__vestraPaddleToken !== response.clientToken) {
    window.Paddle.Initialize({ token: response.clientToken })
    window.__vestraPaddleToken = response.clientToken
  }
}

export function PaddleCheckoutButton({
  interval,
  label,
  copy,
}: {
  interval: PaddleBillingInterval
  label: string
  copy: ReturnType<typeof getBillingCopy>
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function startCheckout() {
    setIsLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/billing/paddle/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const data = (await response.json()) as PaddleCheckoutResponse
      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'paddle_checkout_failed')
      }
      await initializePaddle(data)
      window.Paddle?.Checkout.open({
        items: [{ priceId: data.priceId, quantity: 1 }],
        customer: data.customer,
        customData: data.customData,
        settings: { displayMode: 'overlay', theme: 'light' },
      })
      setMessage(copy.processingWebhook)
    } catch {
      setMessage(copy.checkoutFailed)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={startCheckout} disabled={isLoading}>
        {isLoading ? copy.processing : label}
      </Button>
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}

export function ManageBillingButton({
  label,
  copy,
}: {
  label: string
  copy: ReturnType<typeof getBillingCopy>
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function openPortal() {
    setIsLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/billing/paddle/portal', {
        method: 'POST',
      })
      const data = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !data.url) throw new Error(data.error ?? 'portal')
      window.location.assign(data.url)
    } catch {
      setMessage(copy.portalFailed)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={openPortal}
        disabled={isLoading}
      >
        {isLoading ? copy.processing : label}
      </Button>
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
