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

export type AccountEmailErrorCode =
  | 'email_provider_not_configured'
  | 'email_provider_unauthorized'
  | 'email_sender_not_verified'
  | 'email_provider_rejected'
  | 'email_provider_rate_limited'
  | 'email_provider_timeout'
  | 'email_delivery_failed'

export class AccountEmailProviderError extends Error {
  constructor(
    message: string,
    public readonly code: AccountEmailErrorCode,
    public readonly diagnostics: {
      provider: string
      httpStatus: number | null
      providerErrorCode: string | null
      senderDomain: string | null
      durationMs: number | null
      env: {
        emailProviderPresent: boolean
        emailFromPresent: boolean
        emailReplyToPresent: boolean
        resendApiKeyPresent: boolean
      }
    },
  ) {
    super(message)
    this.name = 'AccountEmailProviderError'
  }
}

function getSenderDomain(from: string | undefined) {
  if (!from) return null
  const match = from.match(/<[^@\s<>]+@([^>\s]+)>|^[^@\s<>]+@([^>\s]+)$/)
  return match?.[1] ?? match?.[2] ?? null
}

function getEmailEnvDiagnostics(provider: string) {
  return {
    provider,
    senderDomain: getSenderDomain(process.env.EMAIL_FROM),
    env: {
      emailProviderPresent: Boolean(process.env.EMAIL_PROVIDER),
      emailFromPresent: Boolean(process.env.EMAIL_FROM),
      emailReplyToPresent: Boolean(process.env.EMAIL_REPLY_TO),
      resendApiKeyPresent: Boolean(process.env.RESEND_API_KEY),
    },
  }
}

function createProviderError(input: {
  message: string
  code: AccountEmailErrorCode
  provider: string
  httpStatus?: number | null
  providerErrorCode?: string | null
  durationMs?: number | null
}) {
  const diagnostics = getEmailEnvDiagnostics(input.provider)
  return new AccountEmailProviderError(input.message, input.code, {
    provider: input.provider,
    httpStatus: input.httpStatus ?? null,
    providerErrorCode: input.providerErrorCode ?? null,
    senderDomain: diagnostics.senderDomain,
    durationMs: input.durationMs ?? null,
    env: diagnostics.env,
  })
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
    const provider = 'resend'
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !from) {
      throw createProviderError({
        message: 'Resend email provider is not configured.',
        code: 'email_provider_not_configured',
        provider,
      })
    }

    const controller = new AbortController()
    const timeoutMs = getEmailRequestTimeoutMs()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const startedAt = performance.now()

    console.info('[email-verification] EMAIL_PROVIDER_REQUEST_STARTED', {
      provider,
      senderDomain: getSenderDomain(from),
      timeoutMs,
    })

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
      const durationMs = Math.round(performance.now() - startedAt)

      if (!response.ok) {
        const status = response.status
        const body = await readResendErrorBody(response)
        const code = mapResendError(status, body)

        console.warn('[email-verification] EMAIL_PROVIDER_REQUEST_FAILED', {
          provider,
          httpStatus: status,
          providerErrorCode: body.providerErrorCode,
          senderDomain: getSenderDomain(from),
          durationMs,
        })

        throw createProviderError({
          message: body.message ?? 'Resend rejected the email request.',
          code,
          provider,
          httpStatus: status,
          providerErrorCode: body.providerErrorCode,
          durationMs,
        })
      }

      console.info('[email-verification] EMAIL_PROVIDER_REQUEST_COMPLETED', {
        provider,
        httpStatus: response.status,
        senderDomain: getSenderDomain(from),
        durationMs,
      })
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn('[email-verification] EMAIL_PROVIDER_REQUEST_FAILED', {
          provider,
          httpStatus: null,
          providerErrorCode: 'timeout',
          senderDomain: getSenderDomain(from),
          durationMs,
        })
        throw createProviderError({
          message: 'Resend email provider timed out.',
          code: 'email_provider_timeout',
          provider,
          providerErrorCode: 'timeout',
          durationMs,
        })
      }

      if (error instanceof AccountEmailProviderError) {
        throw error
      }

      console.warn('[email-verification] EMAIL_PROVIDER_REQUEST_FAILED', {
        provider,
        httpStatus: null,
        providerErrorCode: 'network_error',
        senderDomain: getSenderDomain(from),
        durationMs,
      })
      throw createProviderError({
        message:
          error instanceof Error ? error.message : 'Email delivery failed.',
        code: 'email_delivery_failed',
        provider,
        providerErrorCode: 'network_error',
        durationMs,
      })
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

async function readResendErrorBody(response: Response) {
  let message: string | null = null
  let providerErrorCode: string | null = null

  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as {
        name?: string
        message?: string
        error?: string
        code?: string
        statusCode?: number
      }
      message = body.message ?? body.error ?? null
      providerErrorCode =
        body.code ?? body.name ?? body.error ?? String(body.statusCode ?? '')
    } else {
      const text = await response.text()
      message = text.slice(0, 240) || null
    }
  } catch {
    // Keep the HTTP status as the diagnostic source.
  }

  return {
    message,
    providerErrorCode: providerErrorCode || null,
  }
}

function mapResendError(
  status: number,
  body: { message: string | null; providerErrorCode: string | null },
): AccountEmailErrorCode {
  const normalized = `${body.providerErrorCode ?? ''} ${
    body.message ?? ''
  }`.toLowerCase()

  if (status === 401) return 'email_provider_unauthorized'
  if (
    status === 403 &&
    (normalized.includes('domain') ||
      normalized.includes('sender') ||
      normalized.includes('verified') ||
      normalized.includes('verification'))
  ) {
    return 'email_sender_not_verified'
  }
  if (status === 403) return 'email_provider_unauthorized'
  if (status === 429) return 'email_provider_rate_limited'
  if (status === 408 || status === 504) return 'email_provider_timeout'
  if (status === 400 || status === 422) return 'email_provider_rejected'

  return 'email_delivery_failed'
}

export function getAccountEmailProvider(): AccountEmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? 'manual'

  if (provider === 'resend') {
    return new ResendAccountEmailProvider()
  }

  if (provider === 'manual') {
    if (process.env.NODE_ENV === 'production') {
      throw createProviderError({
        message: 'Manual email provider is not allowed in production.',
        code: 'email_provider_not_configured',
        provider,
      })
    }

    return new ManualAccountEmailProvider()
  }

  throw createProviderError({
    message: `Unsupported account email provider: ${provider}`,
    code: 'email_provider_not_configured',
    provider,
  })
}

export function getAccountEmailProviderDiagnostics() {
  const provider = process.env.EMAIL_PROVIDER ?? 'manual'
  const envDiagnostics = getEmailEnvDiagnostics(provider)

  return {
    provider,
    fromConfigured: envDiagnostics.env.emailFromPresent,
    replyToConfigured: envDiagnostics.env.emailReplyToPresent,
    resendApiKeyConfigured: envDiagnostics.env.resendApiKeyPresent,
    senderDomain: envDiagnostics.senderDomain,
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
