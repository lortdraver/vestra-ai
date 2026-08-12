import { describe, expect, it } from 'vitest'
import {
  getAccountMenuItems,
  getUserAvatarFallback,
  getUserInitials,
} from '@/lib/account-menu'

describe('account menu helpers', () => {
  it('generates initials from the authenticated user name', () => {
    expect(
      getUserInitials({ name: 'Huseyn Aliyev', email: 'h@example.com' }),
    ).toBe('HA')
  })

  it('falls back to the first email character when name is missing', () => {
    expect(getUserInitials({ name: '', email: 'style@example.com' })).toBe('S')
  })

  it('falls back safely when user identity is unavailable', () => {
    expect(getUserInitials(null)).toBe('U')
  })

  it('uses a generic avatar icon fallback only when no initials can be derived', () => {
    expect(
      getUserAvatarFallback({ name: 'Huseyn Aliyev', email: 'h@example.com' }),
    ).toEqual({ kind: 'initials', value: 'HA' })
    expect(
      getUserAvatarFallback({ name: '', email: 'style@example.com' }),
    ).toEqual({ kind: 'initials', value: 'S' })
    expect(getUserAvatarFallback(null)).toEqual({ kind: 'icon' })
  })

  it('keeps admin dashboard out of the regular user menu', () => {
    expect(
      getAccountMenuItems('user').some((item) => item.key === 'admin'),
    ).toBe(false)
  })

  it('does not include duplicate profile and account settings actions', () => {
    const keys = getAccountMenuItems('user').map((item) => item.key as string)

    expect(keys).toContain('accountSettings')
    expect(keys).not.toContain('profile')
  })

  it('shows admin dashboard only for admins', () => {
    expect(
      getAccountMenuItems('moderator').some((item) => item.key === 'admin'),
    ).toBe(false)
    expect(
      getAccountMenuItems('admin').some((item) => item.key === 'admin'),
    ).toBe(true)
  })
})
