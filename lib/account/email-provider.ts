export type AccountEmailKind = 'password_reset' | 'email_verification'

export type AccountEmailInput = {
  to: string
  kind: AccountEmailKind
  locale: string
  subject: string
  text: string
  html: string
  actionUrl?: string
}

export interface AccountEmailProvider {
  send(input: AccountEmailInput): Promise<void>
}

export class ManualAccountEmailProvider implements AccountEmailProvider {
  async send(input: AccountEmailInput): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      const action = input.actionUrl ? new URL(input.actionUrl) : null
      console.info('Account email queued for manual delivery', {
        to: input.to,
        kind: input.kind,
        subject: input.subject,
        actionPath: action ? action.pathname : null,
      })
    }
  }
}

export class ResendAccountEmailProvider implements AccountEmailProvider {
  async send(input: AccountEmailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !from) {
      throw new Error('email_provider_not_configured')
    }

    const controller = new AbortController()
    const timeoutMs = getEmailRequestTimeoutMs()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: process.env.EMAIL_REPLY_TO || undefined,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const status = response.status
        let message = 'email_provider_request_failed'
        try {
          const body = (await response.json()) as { message?: string }
          message = body.message ?? message
        } catch {
          // Keep the sanitized provider status below.
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn('Account email provider request failed', {
            provider: 'resend',
            status,
            message,
          })
        }

        throw new Error(`email_provider_request_failed:${status}`)
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}

function getEmailRequestTimeoutMs() {
  const parsed = Number(process.env.EMAIL_REQUEST_TIMEOUT_MS ?? 10_000)
  if (!Number.isFinite(parsed)) return 10_000
  return Math.min(Math.max(parsed, 2_000), 30_000)
}

export function getAccountEmailProvider(): AccountEmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? 'manual'

  if (provider === 'resend') {
    return new ResendAccountEmailProvider()
  }

  if (provider === 'manual') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('manual_email_provider_not_allowed_in_production')
    }

    return new ManualAccountEmailProvider()
  }

  throw new Error(`Unsupported account email provider: ${provider}`)
}

export function getAccountEmailProviderDiagnostics() {
  const provider = process.env.EMAIL_PROVIDER ?? 'manual'

  return {
    provider,
    fromConfigured: Boolean(process.env.EMAIL_FROM),
    resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
  }
}

export function resetAccountEmailProviderForTests(): void {
  // The provider is stateless today. This hook keeps tests resilient if a cached
  // implementation is introduced later.
}

export function assertEmailProviderReadyForProduction() {
  if (process.env.NODE_ENV !== 'production') return

  const provider = process.env.EMAIL_PROVIDER
  if (!provider || provider === 'manual') {
    throw new Error('production_email_provider_required')
  }

  if (
    provider === 'resend' &&
    (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
  ) {
    throw new Error('resend_email_provider_not_configured')
  }
}

export function getAccountEmailProviderUnsafeForTests(): AccountEmailProvider {
  return new ManualAccountEmailProvider()
}
