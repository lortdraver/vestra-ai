import Link from 'next/link'
import type { ReactNode } from 'react'
import { CookiePreferencesButton } from '@/components/privacy/cookie-preferences-button'
import type { Locale } from '@/lib/i18n/config'
import { publicFooterCopy } from '@/lib/public-content/copy'

export function PublicFooter({
  locale,
  className,
}: {
  locale: Locale
  className?: string
}) {
  const copy = publicFooterCopy[locale]
  const year = new Date().getFullYear()

  return (
    <footer
      className={
        className ??
        'border-t border-border px-6 py-8 text-sm text-muted-foreground md:px-10'
      }
    >
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-[1.1fr_1fr_1fr]">
        <div className="grid gap-3">
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight text-foreground underline-offset-4 hover:underline"
          >
            Vestra
          </Link>
          <p>
            © {year} Vestra. {copy.copyright}
          </p>
        </div>

        <FooterLinkGroup
          title={copy.product.title}
          links={copy.product.links}
        />

        <nav aria-label={copy.legal.title} className="grid gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {copy.legal.title}
          </h2>
          <div className="grid gap-2">
            {copy.legal.links.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
            <CookiePreferencesButton
              label={copy.cookiePreferences}
              className="w-fit min-h-10 text-left"
            />
          </div>
        </nav>
      </div>
    </footer>
  )
}

function FooterLinkGroup({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string }[]
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
