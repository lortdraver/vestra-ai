import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppHeader } from '@/components/app-header'
import { dictionaries } from '@/lib/i18n/dictionaries'

const push = vi.fn()
const refresh = vi.fn()

let mockedSession: {
  data: {
    user?: {
      name?: string | null
      email?: string | null
      image?: string | null
    }
  } | null
  isPending: boolean
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/wardrobe',
  useRouter: () => ({ push, refresh }),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: vi.fn(),
  },
  useSession: () => mockedSession,
}))

describe('AppHeader authenticated mobile shell', () => {
  beforeEach(() => {
    push.mockClear()
    refresh.mockClear()
    mockedSession = {
      data: null,
      isPending: false,
    }
  })

  it('renders a deterministic mobile app header for a minimal authenticated user', () => {
    const html = renderToStaticMarkup(
      <AppHeader
        dictionary={dictionaries.en}
        locale="en"
        user={{
          email: 'user@example.com',
          name: null,
          image: null,
          role: 'user',
          emailVerified: true,
          planKey: 'free',
        }}
      />,
    )

    expect(html).toContain('data-testid="mobile-app-header"')
    expect(html).toContain('data-testid="mobile-account-trigger"')
    expect(html).toContain('Vestra')
    expect(html).toContain('hidden md:block')
    expect(html).toContain('Mobile navigation')
    expect(html).toContain('Wardrobe')
    expect(html).toContain('Stylist')
    expect(html).toContain('Planner')
    expect(html).toContain('Outfits')
    expect(html).toContain('>U<')
    expect(html).not.toContain('Admin dashboard')
  })

  it('keeps the mobile account trigger when name and image are missing but email exists', () => {
    const html = renderToStaticMarkup(
      <AppHeader
        dictionary={dictionaries.en}
        locale="en"
        user={{
          email: 'style@example.com',
          name: null,
          image: null,
          role: 'user',
        }}
      />,
    )

    expect(html).toContain('data-testid="mobile-account-trigger"')
    expect(html).toContain('>S<')
  })

  it('does not require the client session to render the authenticated mobile top bar', () => {
    mockedSession = {
      data: null,
      isPending: true,
    }

    const html = renderToStaticMarkup(
      <AppHeader
        dictionary={dictionaries.en}
        locale="en"
        user={{
          email: 'server-only@example.com',
          name: null,
          image: null,
          role: 'user',
        }}
      />,
    )

    expect(html).toContain('data-testid="mobile-app-header"')
    expect(html).toContain('data-testid="mobile-account-trigger"')
    expect(html).toContain('Mobile navigation')
    expect(html).toContain('>S<')
  })

  it('keeps admin source out of the mobile shell until the account sheet opens', () => {
    const html = renderToStaticMarkup(
      <AppHeader
        dictionary={dictionaries.en}
        locale="en"
        user={{ email: 'admin@example.com', role: 'admin' }}
      />,
    )

    expect(html).toContain('data-testid="mobile-app-header"')
    expect(html).toContain('data-testid="mobile-account-trigger"')
    expect(html).not.toContain('/dashboard/admin')
  })

  it('does not render temporary production debug markers', () => {
    const html = renderToStaticMarkup(
      <AppHeader
        dictionary={dictionaries.en}
        locale="en"
        user={{ email: 'user@example.com', role: 'user' }}
      />,
    )

    expect(html).not.toContain('TOPBAR-V5')
    expect(html).not.toContain('RUNTIME-V4')
    expect(html).not.toContain('mobile-header-debug-marker')
  })
})
