import { canModerate } from '@/lib/roles'

export type AccountMenuUser = {
  name?: string | null
  email?: string | null
  role?: string | null
}

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

export function getUserInitials(user: AccountMenuUser | null | undefined) {
  const nameParts =
    user?.name
      ?.trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean) ?? []

  const initials = nameParts.slice(0, 2).join('')
  if (initials) return initials.toUpperCase()

  const emailFallback = user?.email?.trim()[0]
  return emailFallback ? emailFallback.toUpperCase() : 'U'
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

  if (canModerate(role)) {
    items.push({ key: 'admin', href: '/dashboard/admin' })
  }

  return items
}
