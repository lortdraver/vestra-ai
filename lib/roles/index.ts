export const roles = ['user', 'moderator', 'admin'] as const
export type Role = (typeof roles)[number]

const roleRank: Record<Role, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
}

export function normalizeRole(role: string | null | undefined): Role {
  return roles.includes(role as Role) ? (role as Role) : 'user'
}

export function hasRole(
  currentRole: string | null | undefined,
  required: Role,
) {
  return roleRank[normalizeRole(currentRole)] >= roleRank[required]
}

export function canAccessAdmin(currentRole: string | null | undefined) {
  return hasRole(currentRole, 'admin')
}

export function canModerate(currentRole: string | null | undefined) {
  return hasRole(currentRole, 'moderator')
}
