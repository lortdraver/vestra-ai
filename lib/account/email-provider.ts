export type AccountEmailKind = 'password_reset' | 'email_verification'

export type AccountEmailInput = {
  to: string
  kind: AccountEmailKind
  actionUrl: string
  locale: string
}

export interface AccountEmailProvider {
  send(input: AccountEmailInput): Promise<void>
}

export class ManualAccountEmailProvider implements AccountEmailProvider {
  async send(input: AccountEmailInput): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.info('Account email queued for manual delivery', {
        to: input.to,
        kind: input.kind,
        actionUrl: input.actionUrl,
      })
    }
  }
}

export function getAccountEmailProvider(): AccountEmailProvider {
  return new ManualAccountEmailProvider()
}
