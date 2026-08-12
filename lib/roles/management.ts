import { normalizeRole, roles, type Role } from './index'

export type ManagedUserRole = {
  id: string
  role: string | null | undefined
}

export type UserRoleRepository = {
  findByEmail(email: string): Promise<ManagedUserRole | null>
  updateRole(userId: string, role: Role): Promise<void>
}

export type UserRoleCommandInput = {
  email: string
  requestedRole: string | null | undefined
  apply: boolean
}

export type UserRoleCommandSummary = {
  userExists: boolean
  currentRole: Role | null
  targetRole: Role | null
  dryRun: boolean
  applyRequested: boolean
  willChange: boolean
  changed: boolean
}

export type UserRoleCommandResult =
  | {
      ok: true
      code: 'dry_run' | 'updated' | 'noop'
      exitCode: 0
      summary: UserRoleCommandSummary
    }
  | {
      ok: false
      code: 'invalid_role' | 'unknown_user'
      exitCode: 1
      summary: UserRoleCommandSummary
    }

export function parseRequestedRole(
  value: string | null | undefined,
): Role | null {
  return roles.includes(value as Role) ? (value as Role) : null
}

export function normalizeOperationalEmail(email: string) {
  return email.trim().toLowerCase()
}

function buildSummary(input: {
  currentRole: string | null | undefined
  targetRole: Role | null
  userExists: boolean
  apply: boolean
  changed: boolean
}) {
  const currentRole = input.userExists ? normalizeRole(input.currentRole) : null
  const willChange =
    Boolean(input.userExists) &&
    Boolean(input.targetRole) &&
    currentRole !== input.targetRole

  return {
    userExists: input.userExists,
    currentRole,
    targetRole: input.targetRole,
    dryRun: !input.apply,
    applyRequested: input.apply,
    willChange,
    changed: input.changed,
  } satisfies UserRoleCommandSummary
}

export async function executeUserRoleCommand(
  repository: UserRoleRepository,
  input: UserRoleCommandInput,
): Promise<UserRoleCommandResult> {
  const targetRole = parseRequestedRole(input.requestedRole)

  if (!targetRole) {
    return {
      ok: false,
      code: 'invalid_role',
      exitCode: 1,
      summary: buildSummary({
        currentRole: null,
        targetRole: null,
        userExists: false,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  const user = await repository.findByEmail(
    normalizeOperationalEmail(input.email),
  )

  if (!user) {
    return {
      ok: false,
      code: 'unknown_user',
      exitCode: 1,
      summary: buildSummary({
        currentRole: null,
        targetRole,
        userExists: false,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  const currentRole = normalizeRole(user.role)

  if (!input.apply) {
    return {
      ok: true,
      code: 'dry_run',
      exitCode: 0,
      summary: buildSummary({
        currentRole,
        targetRole,
        userExists: true,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  if (currentRole === targetRole) {
    return {
      ok: true,
      code: 'noop',
      exitCode: 0,
      summary: buildSummary({
        currentRole,
        targetRole,
        userExists: true,
        apply: input.apply,
        changed: false,
      }),
    }
  }

  await repository.updateRole(user.id, targetRole)

  return {
    ok: true,
    code: 'updated',
    exitCode: 0,
    summary: buildSummary({
      currentRole,
      targetRole,
      userExists: true,
      apply: input.apply,
      changed: true,
    }),
  }
}
