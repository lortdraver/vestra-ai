import { describe, expect, it, vi } from 'vitest'
import {
  executeUserRoleCommand,
  parseRequestedRole,
} from '@/lib/roles/management'

describe('user role management', () => {
  it('supports dry run by default without mutating the database', async () => {
    const repository = {
      findByEmail: vi.fn().mockResolvedValue({ id: 'user-1', role: 'user' }),
      updateRole: vi.fn(),
    }

    const result = await executeUserRoleCommand(repository, {
      email: 'User@Example.com',
      requestedRole: 'admin',
      apply: false,
    })

    expect(repository.findByEmail).toHaveBeenCalledWith('user@example.com')
    expect(repository.updateRole).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      code: 'dry_run',
      exitCode: 0,
      summary: {
        userExists: true,
        currentRole: 'user',
        targetRole: 'admin',
        dryRun: true,
        applyRequested: false,
        willChange: true,
        changed: false,
      },
    })
  })

  it('updates the role when --apply is explicitly requested', async () => {
    const repository = {
      findByEmail: vi.fn().mockResolvedValue({ id: 'user-1', role: 'user' }),
      updateRole: vi.fn().mockResolvedValue(undefined),
    }

    const result = await executeUserRoleCommand(repository, {
      email: 'user@example.com',
      requestedRole: 'admin',
      apply: true,
    })

    expect(repository.updateRole).toHaveBeenCalledWith('user-1', 'admin')
    expect(result).toEqual({
      ok: true,
      code: 'updated',
      exitCode: 0,
      summary: {
        userExists: true,
        currentRole: 'user',
        targetRole: 'admin',
        dryRun: false,
        applyRequested: true,
        willChange: true,
        changed: true,
      },
    })
  })

  it('is idempotent when the user already has the target role', async () => {
    const repository = {
      findByEmail: vi.fn().mockResolvedValue({ id: 'user-1', role: 'admin' }),
      updateRole: vi.fn(),
    }

    const result = await executeUserRoleCommand(repository, {
      email: 'user@example.com',
      requestedRole: 'admin',
      apply: true,
    })

    expect(repository.updateRole).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      code: 'noop',
      exitCode: 0,
      summary: {
        userExists: true,
        currentRole: 'admin',
        targetRole: 'admin',
        dryRun: false,
        applyRequested: true,
        willChange: false,
        changed: false,
      },
    })
  })

  it('rejects invalid roles', async () => {
    const repository = {
      findByEmail: vi.fn(),
      updateRole: vi.fn(),
    }

    const result = await executeUserRoleCommand(repository, {
      email: 'user@example.com',
      requestedRole: 'superadmin',
      apply: true,
    })

    expect(repository.findByEmail).not.toHaveBeenCalled()
    expect(parseRequestedRole('superadmin')).toBeNull()
    expect(result).toEqual({
      ok: false,
      code: 'invalid_role',
      exitCode: 1,
      summary: {
        userExists: false,
        currentRole: null,
        targetRole: null,
        dryRun: false,
        applyRequested: true,
        willChange: false,
        changed: false,
      },
    })
  })

  it('rejects unknown users with a non-zero result', async () => {
    const repository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      updateRole: vi.fn(),
    }

    const result = await executeUserRoleCommand(repository, {
      email: 'missing@example.com',
      requestedRole: 'moderator',
      apply: true,
    })

    expect(repository.updateRole).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      code: 'unknown_user',
      exitCode: 1,
      summary: {
        userExists: false,
        currentRole: null,
        targetRole: 'moderator',
        dryRun: false,
        applyRequested: true,
        willChange: false,
        changed: false,
      },
    })
  })
})
