import { createHash, randomBytes } from 'node:crypto'

export type RecoveryToken = {
  token: string
  tokenHash: string
  expiresAt: Date
}

export function hashAccountToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createAccountToken({
  expiresInMinutes,
  now = new Date(),
}: {
  expiresInMinutes: number
  now?: Date
}): RecoveryToken {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now)
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes)

  return {
    token,
    tokenHash: hashAccountToken(token),
    expiresAt,
  }
}

export const accountTokenExpiry = {
  passwordResetMinutes: 30,
  emailVerificationMinutes: 60 * 24,
} as const
