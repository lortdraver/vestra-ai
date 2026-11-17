import Link from 'next/link'
import type { ReactNode } from 'react'
import { CookiePreferencesButton } from '@/components/privacy/cookie-preferences-button'
import type { Locale } from '@/lib/i18n/config'
import { siteFooterCopy } from '@/lib/public-content/copy'

export function PublicFooter({
  locale,
  className,
  authenticated = false,
}: {
  locale: Locale
  className?: string
  authenticated?: boolean
}) {
  const copy = siteFooterCopy[locale]
  const groups = resolveFooterLinkGroups(copy, authenticated)
  const year = new Date().getFullYear()

  const links = [
    ...groups.product.links,
    ...groups.help.links,
    ...groups.legal.links,
  ]

  // One compact block: the main sections now live in the top navigation, so
  // the footer only carries the links people look for at the bottom.
  return (
    <footer
      className={
        className ??
        'border-t border-border px-6 py-6 text-sm text-muted-foreground md:px-10'
      }
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p>
          <Link
            href={authenticated ? '/dashboard' : '/'}
            className="font-serif text-base font-semibold text-foreground"
          >
            Vestra
          </Link>{' '}
          · © {year}
        </p>
        <nav
          aria-label={groups.legal.title}
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          {links.map((link) => (
            <FooterLink key={`${link.href}:${link.label}`} href={link.href}>
              {link.label}
            </FooterLink>
          ))}
          <CookiePreferencesButton
            label={copy.cookiePreferences}
            className="min-h-10 text-left"
          />
        </nav>
      </div>
    </footer>
  )
}

type FooterCopy = (typeof siteFooterCopy)[Locale]
type FooterResolvedLink = { label: string; href: string }
type FooterResolvedGroup = { title: string; links: FooterResolvedLink[] }

const authenticatedProductRoutes: Record<string, string> = {
  home: '/dashboard',
  wardrobe: '/dashboard/wardrobe',
  stylist: '/dashboard/stylist',
  planner: '/dashboard/planner',
  savedLooks: '/dashboard/outfits',
  pricing: '/pricing',
}

const publicProductRoutes: Record<string, string | null> = {
  home: '/',
  wardrobe: null,
  stylist: null,
  planner: null,
  savedLooks: null,
  pricing: '/pricing',
}

const helpRoutes: Record<string, string> = {
  faq: '/faq',
  support: '/support',
  feedback: '/support',
}

const legalRoutes: Record<string, string> = {
  privacy: '/privacy',
  terms: '/terms',
  refund: '/refund',
}

function resolveFooterLinkGroups(
  copy: FooterCopy,
  authenticated: boolean,
): Record<'product' | 'help' | 'legal', FooterResolvedGroup> {
  return {
    product: {
      title: copy.product.title,
      links: resolveFooterLinks(
        copy.product.links,
        authenticated ? authenticatedProductRoutes : publicProductRoutes,
      ),
    },
    help: {
      title: copy.help.title,
      links: resolveFooterLinks(copy.help.links, helpRoutes),
    },
    legal: {
      title: copy.legal.title,
      links: resolveFooterLinks(copy.legal.links, legalRoutes),
    },
  }
}

function resolveFooterLinks(
  links: { key: string; label: string }[],
  routes: Record<string, string | null>,
): FooterResolvedLink[] {
  return links.flatMap((link) => {
    const href = routes[link.key]

    return href ? [{ label: link.label, href }] : []
  })
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 w-fit items-center font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  )
}
