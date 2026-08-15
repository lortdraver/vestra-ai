import { describe, expect, it, vi } from 'vitest'
import {
  executeInternalOverrideCommand,
  parseInternalOverrideAction,
  type InternalOverrideRepository,
} from '@/lib/subscription/internal-overrides'
import {
  getSubscriptionPageState,
  getSubscriptionSwitchTarget,
} from '@/lib/billing/subscription-page-model'
import { getSubscriptionPlan } from '@/lib/subscription/plans'
import type { SubscriptionSnapshot } from '@/lib/subscription/types'

function createRepository(
  overrides: Partial<InternalOverrideRepository> = {},
): InternalOverrideRepository {
  return {
    findUserByEmail: vi.fn().mockResolvedValue({ id: 'user-1', role: 'admin' }),
    getOverrideState: vi.fn().mockResolvedValue({
      active: false,
      providerCustomerIdPresent: false,
      providerSubscriptionIdPresent: false,
      paddleSubscriptionCount: 0,
    }),
    grantProOverride: vi.fn().mockResolvedValue(undefined),
    revokeOverride: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createSnapshot(
  input: Partial<SubscriptionSnapshot>,
): SubscriptionSnapshot {
  return {
    plan: getSubscriptionPlan('free'),
    status: 'active',
    isPremium: false,
    entitlementSource: 'free',
    isTrialActive: false,
    trialEndsAt: null,
    billingInterval: null,
    currentPeriodEnd: null,
    accessUntil: null,
    graceUntil: null,
    paymentIssue: false,
    entitlementReason: 'free',
    cancelAtPeriodEnd: false,
    usage: {
      wardrobe_items: 0,
      ai_analyses_monthly: 0,
      stylist_requests_monthly: 0,
      background_removals_monthly: 0,
      saved_outfits: 0,
    },
    ...input,
  }
}

describe('internal subscription override management', () => {
  it('parses only explicit override actions', () => {
    expect(parseInternalOverrideAction('grant_pro')).toBe('grant_pro')
    expect(parseInternalOverrideAction('revoke')).toBe('revoke')
    expect(parseInternalOverrideAction('premium')).toBeNull()
  })

  it('dry-runs a Pro grant by default', async () => {
    const repository = createRepository()

    await expect(
      executeInternalOverrideCommand(repository, {
        email: 'Owner@Vestra.Test ',
        action: 'grant_pro',
        apply: false,
      }),
    ).resolves.toMatchObject({
      ok: true,
      code: 'dry_run',
      summary: {
        userExists: true,
        currentRole: 'admin',
        targetPlan: 'premium',
        source: 'internal_override',
        dryRun: true,
        willChange: true,
        changed: false,
      },
    })
    expect(repository.grantProOverride).not.toHaveBeenCalled()
  })

  it('grants Pro only when --apply is requested', async () => {
    const repository = createRepository()

    await expect(
      executeInternalOverrideCommand(repository, {
        email: 'owner@vestra.test',
        action: 'grant_pro',
        apply: true,
      }),
    ).resolves.toMatchObject({
      ok: true,
      code: 'granted',
      summary: { changed: true },
    })
    expect(repository.grantProOverride).toHaveBeenCalledWith('user-1')
  })

  it('is idempotent when the override already exists', async () => {
    const repository = createRepository({
      getOverrideState: vi.fn().mockResolvedValue({
        active: true,
        providerCustomerIdPresent: false,
        providerSubscriptionIdPresent: false,
        paddleSubscriptionCount: 0,
      }),
    })

    await expect(
      executeInternalOverrideCommand(repository, {
        email: 'owner@vestra.test',
        action: 'grant_pro',
        apply: true,
      }),
    ).resolves.toMatchObject({
      ok: true,
      code: 'noop',
      summary: { activeOverride: true, changed: false },
    })
    expect(repository.grantProOverride).not.toHaveBeenCalled()
  })

  it('rejects non-admin targets so normal users cannot be granted Pro', async () => {
    const repository = createRepository({
      findUserByEmail: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', role: 'user' }),
    })

    await expect(
      executeInternalOverrideCommand(repository, {
        email: 'user@vestra.test',
        action: 'grant_pro',
        apply: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'target_not_admin',
      summary: { currentRole: 'user', changed: false },
    })
    expect(repository.grantProOverride).not.toHaveBeenCalled()
  })

  it('rejects unsafe override rows with provider identifiers', async () => {
    const repository = createRepository({
      getOverrideState: vi.fn().mockResolvedValue({
        active: true,
        providerCustomerIdPresent: false,
        providerSubscriptionIdPresent: true,
        paddleSubscriptionCount: 0,
      }),
    })

    await expect(
      executeInternalOverrideCommand(repository, {
        email: 'owner@vestra.test',
        action: 'revoke',
        apply: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'unsafe_override_state',
    })
    expect(repository.revokeOverride).not.toHaveBeenCalled()
  })
})

describe('internal Pro entitlement UI model', () => {
  it('gives internal override users the Pro plan without Paddle switch actions', () => {
    const snapshot = createSnapshot({
      plan: getSubscriptionPlan('premium'),
      isPremium: true,
      entitlementSource: 'internal_override',
      entitlementReason: 'active',
      status: 'active',
    })

    expect(getSubscriptionPageState(snapshot)).toBe('active_pro')
    expect(getSubscriptionSwitchTarget(snapshot)).toBeNull()
    expect(snapshot.plan.limits.wardrobe_items).toBe(300)
    expect(snapshot.plan.limits.ai_analyses_monthly).toBe(500)
    expect(snapshot.plan.limits.stylist_requests_monthly).toBe(250)
    expect(snapshot.plan.limits.saved_outfits).toBe(500)
  })

  it('keeps normal Paddle Pro switch behavior for paid subscriptions', () => {
    const snapshot = createSnapshot({
      plan: getSubscriptionPlan('premium'),
      isPremium: true,
      entitlementSource: 'paddle',
      entitlementReason: 'active',
      billingInterval: 'monthly',
      status: 'active',
    })

    expect(getSubscriptionPageState(snapshot)).toBe('active_pro')
    expect(getSubscriptionSwitchTarget(snapshot)).toBe('annual')
  })

  it('keeps normal Free accounts on Free', () => {
    const snapshot = createSnapshot({})

    expect(getSubscriptionPageState(snapshot)).toBe('free')
    expect(getSubscriptionSwitchTarget(snapshot)).toBeNull()
    expect(snapshot.plan.key).toBe('free')
  })
})
