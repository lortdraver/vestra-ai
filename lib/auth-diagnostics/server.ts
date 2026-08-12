import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { account, user } from '@/lib/db/schema'
import { getAuthOriginDiagnostics } from '@/lib/auth-origin'

export type UserCredentialDiagnostic = {
  userExists: boolean
  emailVerified: boolean
  accountRowCount: number
  credentialAccountCount: number
  providerIds: string[]
  credentialProviderIds: string[]
  credentialPasswordPresent: boolean
  duplicateCredentialAccountDetected: boolean
}

function summarizeCredentialState(
  currentUser: { id: string; emailVerified: boolean } | undefined,
  accountRows: Array<{ providerId: string; password: string | null }>,
): UserCredentialDiagnostic {
  const credentialRows = accountRows.filter(
    (accountRow) => accountRow.providerId === 'credential',
  )

  return {
    userExists: Boolean(currentUser),
    emailVerified: currentUser?.emailVerified ?? false,
    accountRowCount: accountRows.length,
    credentialAccountCount: credentialRows.length,
    providerIds: Array.from(
      new Set(accountRows.map((accountRow) => accountRow.providerId)),
    ),
    credentialProviderIds: Array.from(
      new Set(credentialRows.map((accountRow) => accountRow.providerId)),
    ),
    credentialPasswordPresent: credentialRows.some(
      (accountRow) =>
        typeof accountRow.password === 'string' &&
        accountRow.password.length > 0,
    ),
    duplicateCredentialAccountDetected: credentialRows.length > 1,
  }
}

export async function getUserCredentialDiagnosticByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const [currentUser] = await db
    .select({
      id: user.id,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1)

  if (!currentUser) {
    return summarizeCredentialState(undefined, [])
  }

  const accountRows = await db
    .select({
      providerId: account.providerId,
      password: account.password,
    })
    .from(account)
    .where(eq(account.userId, currentUser.id))

  return summarizeCredentialState(currentUser, accountRows)
}

export async function getUserCredentialDiagnosticByUserId(userId: string) {
  const [currentUser] = await db
    .select({
      id: user.id,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!currentUser) {
    return summarizeCredentialState(undefined, [])
  }

  const accountRows = await db
    .select({
      providerId: account.providerId,
      password: account.password,
    })
    .from(account)
    .where(eq(account.userId, userId))

  return summarizeCredentialState(currentUser, accountRows)
}

export function getRequestOriginFromHeaders(headers: Headers) {
  const origin = headers.get('origin')
  if (origin) return origin

  const referer = headers.get('referer')
  if (!referer) return null

  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

export function getServerAuthOriginDiagnostic(headers: Headers) {
  return getAuthOriginDiagnostics(getRequestOriginFromHeaders(headers))
}
