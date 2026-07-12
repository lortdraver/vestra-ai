import { describe, expect, it } from 'vitest'
import { getAccountMenuItems, getUserInitials } from '@/lib/account-menu'

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

  it('shows admin dashboard for moderators and admins', () => {
    expect(
      getAccountMenuItems('moderator').some((item) => item.key === 'admin'),
    ).toBe(true)
    expect(
      getAccountMenuItems('admin').some((item) => item.key === 'admin'),
    ).toBe(true)
  })
})
