import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAccountDeletionBlocker } from '@/lib/account/deletion'

const deletionSource = readFileSync(
  join(process.cwd(), 'lib/account/deletion.ts'),
  'utf8',
)
const schemaSource = readFileSync(
  join(process.cwd(), 'lib/db/schema.ts'),
  'utf8',
)

describe('account deletion', () => {
  it('blocks deletion while a Paddle subscription will renew', () => {
    expect(
      getAccountDeletionBlocker({
        isPremium: true,
        entitlementSource: 'paddle',
        cancelAtPeriodEnd: false,
        status: 'active',
      }),
    ).toBe('active_subscription')
  })

  it('allows deletion for free, trial, override and canceling users', () => {
    for (const snapshot of [
      {
        isPremium: false,
        entitlementSource: 'free',
        cancelAtPeriodEnd: false,
        status: 'active',
      },
      {
        isPremium: true,
        entitlementSource: 'trial',
        cancelAtPeriodEnd: false,
        status: 'trialing',
      },
      {
        isPremium: true,
        entitlementSource: 'internal_override',
        cancelAtPeriodEnd: false,
        status: 'active',
      },
      {
        isPremium: true,
        entitlementSource: 'paddle',
        cancelAtPeriodEnd: true,
        status: 'active',
      },
    ] as const) {
      expect(getAccountDeletionBlocker(snapshot)).toBeNull()
    }
  })

  it('removes personal data from every user-owned app table', () => {
    const retainedOnPurpose = new Set([
      'subscription',
      'billingTransaction',
      'auditLog',
      'wardrobeImageDeletionQueue',
      // Better Auth deletes these itself (user row + FK cascades).
      'session',
      'account',
    ])
    const userOwnedTables = Array.from(
      schemaSource.matchAll(
        /export const (\w+) = pgTable\([\s\S]*?(?=\nexport const |$)/g,
      ),
    )
      .filter((match) => /\buserId: text\('userId'\)/.test(match[0]))
      .map((match) => match[1])
      .filter((name) => !retainedOnPurpose.has(name))

    expect(userOwnedTables.length).toBeGreaterThan(10)
    for (const table of userOwnedTables) {
      expect(deletionSource, `missing delete for ${table}`).toContain(
        `schema.${table}`,
      )
    }
  })
})
