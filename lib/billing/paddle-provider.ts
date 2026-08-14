import {
  getPaddleServerConfig,
  type PaddleBillingInterval,
} from './paddle-config'

export type PaddleCheckoutSession = {
  priceId: string
  interval: PaddleBillingInterval
  customData: { vestraUserId: string }
  customer?: { email: string }
}

export class PaddleApiError extends Error {
  constructor(
    public code:
      | 'paddle_checkout_failed'
      | 'paddle_api_unauthorized'
      | 'paddle_api_rate_limited'
      | 'paddle_api_timeout'
      | 'paddle_subscription_not_found'
      | 'paddle_subscription_action_failed',
    public status = 500,
  ) {
    super(code)
  }
}

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) }
}

function mapPaddleStatus(status: number) {
  if (status === 401 || status === 403) {
    return new PaddleApiError('paddle_api_unauthorized', status)
  }
  if (status === 404) {
    return new PaddleApiError('paddle_subscription_not_found', status)
  }
  if (status === 429) {
    return new PaddleApiError('paddle_api_rate_limited', status)
  }
  return new PaddleApiError('paddle_subscription_action_failed', status)
}

async function paddleRequest<T>(
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PATCH'
    body?: Record<string, unknown>
  } = {},
): Promise<T> {
  const config = getPaddleServerConfig()
  const timeout = timeoutSignal(config.requestTimeoutMs)
  let response: Response

  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: init.method ?? 'GET',
      signal: timeout.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new PaddleApiError('paddle_api_timeout', 504)
    }
    throw new PaddleApiError('paddle_subscription_action_failed', 502)
  } finally {
    timeout.cancel()
  }

  if (!response.ok) throw mapPaddleStatus(response.status)
  return (await response.json()) as T
}

export function createPaddleCheckoutSession(input: {
  userId: string
  email: string
  interval: PaddleBillingInterval
}): PaddleCheckoutSession {
  const config = getPaddleServerConfig()
  return {
    priceId:
      input.interval === 'annual'
        ? config.annualPriceId
        : config.monthlyPriceId,
    interval: input.interval,
    customData: { vestraUserId: input.userId },
    customer: { email: input.email },
  }
}

export async function createPaddlePortalSession(input: {
  customerId: string
  subscriptionId?: string | null
}) {
  const payload = await paddleRequest<{
    data?: {
      urls?: {
        general?: string | { overview?: string }
        subscriptions?: Array<{
          id?: string
          cancel_subscription?: string
          update_payment_method?: string
        }>
      }
    }
  }>(`/customers/${encodeURIComponent(input.customerId)}/portal-sessions`, {
    method: 'POST',
    body: {
      subscription_ids: input.subscriptionId ? [input.subscriptionId] : [],
    },
  })
  const general = payload.data?.urls?.general
  const url =
    typeof general === 'string'
      ? general
      : (general?.overview ??
        payload.data?.urls?.subscriptions?.[0]?.update_payment_method ??
        payload.data?.urls?.subscriptions?.[0]?.cancel_subscription)
  if (!url) throw new PaddleApiError('paddle_checkout_failed', 502)
  return {
    url,
    cancelUrl: payload.data?.urls?.subscriptions?.[0]?.cancel_subscription,
    updatePaymentMethodUrl:
      payload.data?.urls?.subscriptions?.[0]?.update_payment_method,
  }
}

export async function cancelPaddleSubscription(subscriptionId: string) {
  return paddleRequest(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: 'POST',
      body: { effective_from: 'next_billing_period' },
    },
  )
}

export async function resumePaddleScheduledCancellation(
  subscriptionId: string,
) {
  return paddleRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'PATCH',
    body: { scheduled_change: null },
  })
}

export async function switchPaddleSubscriptionPlan(input: {
  subscriptionId: string
  interval: PaddleBillingInterval
}) {
  const config = getPaddleServerConfig()
  const priceId =
    input.interval === 'annual' ? config.annualPriceId : config.monthlyPriceId
  return paddleRequest(
    `/subscriptions/${encodeURIComponent(input.subscriptionId)}`,
    {
      method: 'PATCH',
      body: {
        proration_billing_mode: 'prorated_immediately',
        items: [{ price_id: priceId, quantity: 1 }],
      },
    },
  )
}

export async function fetchPaddleSubscription(subscriptionId: string) {
  return paddleRequest<{
    data?: Record<string, unknown>
  }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
}
