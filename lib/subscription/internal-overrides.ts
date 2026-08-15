import { normalizeRole, type Role } from '@/lib/roles'

export const internalOverrideProviderKey = 'internal_override'

export type InternalOverrideAction = 'grant_pro' | 'revoke'

export type InternalOverrideUser = {
  id: string
  role: string | null | undefined
}

export type InternalOverrideState = {
  active: boolean
  providerCustomerIdPresent: boolean
  providerSubscriptionIdPresent: boolean
  paddleSubscriptionCount: number
}

export type InternalOverrideRepository = {
  findUserByEmail(email: string): Promise<InternalOverrideUser | null>
  getOverrideState(userId: string): Promise<InternalOverrideState>
  grantProOverride(userId: string): Promise<void>
  revokeOverride(userId: string): Promise<void>
}

export type InternalOverrideCommandInput = {
  email: string
  action: string | null | undefined
  apply: boolean
}

export type InternalOverrideCommandSummary = {
  userExists: boolean
  currentRole: Role | null
  targetPlan: 'premium' | 'free' | null
  source: 'internal_override' | null
  activeOverride: boolean
  dryRun: boolean
  applyRequested: boolean
  willChange: boolean
  changed: boolean
  paddleSubscriptionCount: number
}

export type InternalOverrideCommandResult =
  | {
      ok: true
      code: 'dry_run' | 'granted' | 'revoked' | 'noop'
      exitCode: 0
      summary: InternalOverrideCommandSummary
    }
  | {
      ok: false
      code:
        | 'invalid_action'
        | 'unknown_user'
        | 'target_not_admin'
        | 'unsafe_override_state'
      exitCode: 1
      summary: InternalOverrideCommandSummary
    }

export function normalizeOperationalEmail(email: string) {
  return email.trim().toLowerCase()
}

export function parseInternalOverrideAction(
  value: string | null | undefined,
): InternalOverrideAction | null {
  return value === 'grant_pro' || value === 'revoke' ? value : null
}

function buildSummary(input: {
  userExists: boolean
  currentRole: Role | null
  action: InternalOverrideAction | null
  state: InternalOverrideState | null
  apply: boolean
  changed: boolean
}): InternalOverrideCommandSummary {
  const activeOverride = input.state?.active ?? false
  const willChange =
    input.userExists &&
    Boolean(input.action) &&
    ((input.action === 'grant_pro' && !activeOverride) ||
      (input.action === 'revoke' && activeOverride))

  return {
    userExists: input.userExists,
    currentRole: input.currentRole,
    targetPlan:
      input.action === 'grant_pro'
        ? 'premium'
        : input.action === 'revoke'
          ? 'free'
          : null,
    source: input.action ? internalOverrideProviderKey : null,
    activeOverride,
    dryRun: !input.apply,
    applyRequested: input.apply,
    willChange,
    changed: input.changed,
    paddleSubscriptionCount: input.state?.paddleSubscriptionCount ?? 0,
  }
}

export async function executeInternalOverrideCommand(
  repository: InternalOverrideRepository,
  input: InternalOverrideCommandInput,
): Promise<InternalOverrideCommandResult> {
  const action = parseInternalOverrideAction(input.action)

  if (!action) {
    return {
      ok: false,
      code: 'invalid_action',
      exitCode: 1,
      summary: buildSummary({
        userExists: false,
        currentRole: null,
        action: null,
        state: null,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  const user = await repository.findUserByEmail(
    normalizeOperationalEmail(input.email),
  )

  if (!user) {
    return {
      ok: false,
      code: 'unknown_user',
      exitCode: 1,
      summary: buildSummary({
        userExists: false,
        currentRole: null,
        action,
        state: null,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  const role = normalizeRole(user.role)
  const state = await repository.getOverrideState(user.id)

  if (role !== 'admin') {
    return {
      ok: false,
      code: 'target_not_admin',
      exitCode: 1,
      summary: buildSummary({
        userExists: true,
        currentRole: role,
        action,
        state,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  if (state.providerCustomerIdPresent || state.providerSubscriptionIdPresent) {
    return {
      ok: false,
      code: 'unsafe_override_state',
      exitCode: 1,
      summary: buildSummary({
        userExists: true,
        currentRole: role,
        action,
        state,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  if (!input.apply) {
    return {
      ok: true,
      code: 'dry_run',
      exitCode: 0,
      summary: buildSummary({
        userExists: true,
        currentRole: role,
        action,
        state,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  if (action === 'grant_pro') {
    if (state.active) {
      return {
        ok: true,
        code: 'noop',
        exitCode: 0,
        summary: buildSummary({
          userExists: true,
          currentRole: role,
          action,
          state,
          apply: input.apply,
          changed: false,
        }),
      }
    }

    await repository.grantProOverride(user.id)
    return {
      ok: true,
      code: 'granted',
      exitCode: 0,
      summary: buildSummary({
        userExists: true,
        currentRole: role,
        action,
        state,
        apply: input.apply,
        changed: true,
      }),
    }
  }

  if (!state.active) {
    return {
      ok: true,
      code: 'noop',
      exitCode: 0,
      summary: buildSummary({
        userExists: true,
        currentRole: role,
        action,
        state,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  await repository.revokeOverride(user.id)
  return {
    ok: true,
    code: 'revoked',
    exitCode: 0,
    summary: buildSummary({
      userExists: true,
      currentRole: role,
      action,
      state,
      apply: input.apply,
      changed: true,
    }),
  }
}
