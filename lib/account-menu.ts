import { canAccessAdmin } from '@/lib/roles'

export type AccountMenuUser = {
  name?: string | null
  email?: string | null
  role?: string | null
}

export type UserAvatarFallback =
  { kind: 'initials'; value: string } | { kind: 'icon' }

export type AccountMenuItemKey =
  | 'accountSettings'
  | 'subscription'
  | 'stylistPreferences'
  | 'privacy'
  | 'admin'

export type AccountMenuItem = {
  key: AccountMenuItemKey
  href: string
}

export function getUserAvatarFallback(
  user: AccountMenuUser | null | undefined,
): UserAvatarFallback {
  const nameParts =
    user?.name
      ?.trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean) ?? []

  const initials = nameParts.slice(0, 2).join('')
  if (initials) {
    return { kind: 'initials', value: initials.toUpperCase() }
  }

  const emailFallback = user?.email?.trim()[0]
  if (emailFallback) {
    return { kind: 'initials', value: emailFallback.toUpperCase() }
  }

  return { kind: 'icon' }
}

export function getUserInitials(user: AccountMenuUser | null | undefined) {
  const fallback = getUserAvatarFallback(user)
  return fallback.kind === 'initials' ? fallback.value : 'U'
}

export function getAccountMenuItems(
  role: string | null | undefined,
): AccountMenuItem[] {
  const items: AccountMenuItem[] = [
    { key: 'accountSettings', href: '/dashboard/account' },
    { key: 'subscription', href: '/dashboard/account#subscription' },
    { key: 'stylistPreferences', href: '/dashboard/stylist#preferences' },
    { key: 'privacy', href: '/dashboard/account#privacy' },
  ]

  if (canAccessAdmin(role)) {
    items.push({ key: 'admin', href: '/dashboard/admin' })
  }

  return items
}
