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
      | 'paddle_subscription_not_found',
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
  return new PaddleApiError('paddle_checkout_failed', status)
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
  const config = getPaddleServerConfig()
  const timeout = timeoutSignal(config.requestTimeoutMs)
  let response: Response

  try {
    response = await fetch(
      `${config.apiBaseUrl}/customers/${encodeURIComponent(
        input.customerId,
      )}/portal-sessions`,
      {
        method: 'POST',
        signal: timeout.signal,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_ids: input.subscriptionId ? [input.subscriptionId] : [],
        }),
      },
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new PaddleApiError('paddle_api_timeout', 504)
    }
    throw new PaddleApiError('paddle_checkout_failed', 502)
  } finally {
    timeout.cancel()
  }

  if (!response.ok) throw mapPaddleStatus(response.status)

  const payload = (await response.json()) as {
    data?: { urls?: { general?: string } }
  }
  const url = payload.data?.urls?.general
  if (!url) throw new PaddleApiError('paddle_checkout_failed', 502)
  return { url }
}
