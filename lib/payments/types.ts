import type { SubscriptionPlanKey } from '@/lib/subscription'

export const paymentProviderKeys = [
  'stripe',
  'payriff',
  'epoint',
  'manual',
] as const
export type PaymentProviderKey = (typeof paymentProviderKeys)[number]

export type CheckoutInput = {
  userId: string
  planKey: SubscriptionPlanKey
  successUrl: string
  cancelUrl: string
}

export type CheckoutResult = {
  provider: PaymentProviderKey
  status: 'not_configured' | 'pending_manual_activation'
  checkoutUrl: string | null
  message: string
}

export interface PaymentProvider {
  key: PaymentProviderKey
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
}
