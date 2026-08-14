import type {
  CheckoutResult,
  PaymentProvider,
  PaymentProviderKey,
} from './types'
import { getPaddleDiagnostics } from '@/lib/billing'

abstract class AbstractPendingProvider implements PaymentProvider {
  abstract key: PaymentProviderKey

  async createCheckout(): Promise<CheckoutResult> {
    return {
      provider: this.key,
      status: 'not_configured',
      checkoutUrl: null,
      message: `${this.key} checkout is not connected yet.`,
    }
  }
}

export class StripeProvider extends AbstractPendingProvider {
  key = 'stripe' as const
}

export class PaddleProvider implements PaymentProvider {
  key = 'paddle' as const

  async createCheckout(): Promise<CheckoutResult> {
    const diagnostics = getPaddleDiagnostics()
    return {
      provider: this.key,
      status:
        diagnostics.hasApiKey &&
        diagnostics.hasClientToken &&
        diagnostics.hasMonthlyPriceId &&
        diagnostics.hasAnnualPriceId
          ? 'configured'
          : 'not_configured',
      checkoutUrl: null,
      message: 'Paddle checkout is handled by the authenticated billing API.',
    }
  }
}

export class PayriffProvider extends AbstractPendingProvider {
  key = 'payriff' as const
}

export class EpointProvider extends AbstractPendingProvider {
  key = 'epoint' as const
}

export class ManualProvider implements PaymentProvider {
  key = 'manual' as const

  async createCheckout(): Promise<CheckoutResult> {
    return {
      provider: this.key,
      status: 'pending_manual_activation',
      checkoutUrl: null,
      message: 'Manual subscription activation is available for internal use.',
    }
  }
}

export function getPaymentProvider(
  provider: PaymentProviderKey = 'manual',
): PaymentProvider {
  switch (provider) {
    case 'paddle':
      return new PaddleProvider()
    case 'stripe':
      return new StripeProvider()
    case 'payriff':
      return new PayriffProvider()
    case 'epoint':
      return new EpointProvider()
    case 'manual':
      return new ManualProvider()
  }
}
