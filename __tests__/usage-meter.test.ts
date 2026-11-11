import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  row: null as null | { id: string; used: number },
  inserted: [] as unknown[],
  updated: [] as unknown[],
  locks: 0,
  limit: 20 as number | null,
}))

vi.mock('@/lib/db', () => {
  const tx = {
    execute: vi.fn(async () => {
      state.locks += 1
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (state.row ? [state.row] : []),
        }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: async () => {
          state.updated.push(values)
        },
      }),
    }),
    insert: () => ({
      values: async (values: unknown) => {
        state.inserted.push(values)
      },
    }),
  }
  return {
    db: { transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
  }
})

vi.mock('@/lib/subscription/entitlements', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/subscription/entitlements')>()
  return {
    ...original,
    getUserEntitlements: vi.fn(async () => ({
      plan: { limits: { ai_analyses_monthly: state.limit } },
    })),
  }
})

import {
  canConsumeUsage,
  consumeMonthlyUsage,
} from '@/lib/subscription/usage-meter'
import { EntitlementError } from '@/lib/subscription/entitlements'

afterEach(() => {
  state.row = null
  state.inserted = []
  state.updated = []
  state.locks = 0
  state.limit = 20
})

describe('monthly usage metering', () => {
  it('allows consumption below the limit and for unlimited plans', () => {
    expect(canConsumeUsage(19, 20)).toBe(true)
    expect(canConsumeUsage(20, 20)).toBe(false)
    expect(canConsumeUsage(10_000, null)).toBe(true)
  })

  it('creates the monthly usage row on first use under an advisory lock', async () => {
    const result = await consumeMonthlyUsage('user_1', 'ai_analyses_monthly')

    expect(result).toEqual({ used: 1, limit: 20 })
    expect(state.locks).toBe(1)
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted[0]).toMatchObject({
      userId: 'user_1',
      featureKey: 'ai_analyses_monthly',
      used: 1,
    })
  })

  it('increments an existing row', async () => {
    state.row = { id: 'usage_1', used: 7 }

    const result = await consumeMonthlyUsage('user_1', 'ai_analyses_monthly')

    expect(result.used).toBe(8)
    expect(state.updated[0]).toMatchObject({ used: 8 })
  })

  it('rejects consumption once the plan limit is reached', async () => {
    state.row = { id: 'usage_1', used: 20 }

    await expect(
      consumeMonthlyUsage('user_1', 'ai_analyses_monthly'),
    ).rejects.toBeInstanceOf(EntitlementError)
    expect(state.updated).toHaveLength(0)
  })
})
