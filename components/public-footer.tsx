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

  return (
    <footer
      className={
        className ??
        'border-t border-border px-6 py-8 text-sm text-muted-foreground md:px-10'
      }
    >
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
        <div className="grid gap-3">
          <Link
            href={authenticated ? '/dashboard' : '/'}
            className="font-serif text-xl font-semibold tracking-tight text-foreground underline-offset-4 hover:underline"
          >
            Vestra
          </Link>
          <p className="max-w-xs leading-relaxed">{copy.description}</p>
          <p>
            © {year} Vestra. {copy.copyright}
          </p>
        </div>

        <FooterLinkGroup
          title={groups.product.title}
          links={groups.product.links}
        />

        <FooterLinkGroup title={groups.help.title} links={groups.help.links} />

        <nav aria-label={groups.legal.title} className="grid gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {groups.legal.title}
          </h2>
          <div className="grid gap-2">
            {groups.legal.links.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
            <CookiePreferencesButton
              label={copy.cookiePreferences}
              className="min-h-10 w-fit text-left"
            />
          </div>
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

function FooterLinkGroup({
  title,
  links,
}: {
  title: string
  links: FooterResolvedLink[]
}) {
  return (
    <nav aria-label={title} className="grid gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-2">
        {links.map((link) => (
          <FooterLink key={link.href} href={link.href}>
            {link.label}
          </FooterLink>
        ))}
      </div>
    </nav>
  )
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
