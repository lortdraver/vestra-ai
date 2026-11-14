import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { buttonVariants } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/language-switcher'
import { PublicFooter } from '@/components/public-footer'
import { siteFooterCopy } from '@/lib/public-content/copy'
import { landingCopy } from '@/lib/public-content/landing-copy'
import { LandingStyles } from '@/components/landing/landing-styles'
import { HeroShowcase } from '@/components/landing/hero-showcase'
import {
  FinalCta,
  HowItWorks,
  OutfitOfTheDay,
} from '@/components/landing/landing-sections'

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/dashboard')

  const dictionary = await getDictionary()
  const locale = await getLocale()
  const footerCopy = siteFooterCopy[locale]
  const copy = landingCopy[locale]
  const publicLinks = [
    {
      href: '/pricing',
      label: getFooterLabel(footerCopy.product.links, 'pricing'),
    },
    { href: '/faq', label: getFooterLabel(footerCopy.help.links, 'faq') },
    {
      href: '/support',
      label: getFooterLabel(footerCopy.help.links, 'support'),
    },
  ]

  return (
    <div className="landing flex min-h-svh flex-col bg-background">
      <LandingStyles />
      <header className="flex items-center justify-between gap-4 px-6 py-5 md:px-10">
        <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
          {dictionary.common.brand}
        </span>
        <nav className="flex items-center gap-3">
          <div className="hidden items-center gap-1 md:flex">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <LanguageSwitcher
            currentLocale={locale}
            label={dictionary.common.language}
          />
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: 'ghost' })}
          >
            {dictionary.common.signIn}
          </Link>
          <Link href="/sign-up" className={buttonVariants()}>
            {dictionary.common.signUp}
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="overflow-x-clip px-6 md:px-10">
          <div className="mx-auto grid max-w-6xl items-center gap-14 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
            <div className="landing-hero-in text-center md:text-left">
              <p className="text-sm font-medium uppercase tracking-widest text-accent">
                {dictionary.landing.eyebrow}
              </p>
              <h1 className="mt-4 font-serif text-4xl font-medium leading-tight tracking-tight text-foreground text-balance md:text-6xl">
                {dictionary.landing.headline}
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground text-pretty">
                {dictionary.landing.body}
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row md:justify-start">
                <Link
                  href="/sign-up"
                  className={buttonVariants({ size: 'lg', className: 'px-5' })}
                >
                  {dictionary.landing.primaryCta}
                </Link>
                <Link
                  href="/sign-in"
                  className={buttonVariants({
                    size: 'lg',
                    variant: 'outline',
                    className: 'px-5',
                  })}
                >
                  {dictionary.landing.secondaryCta}
                </Link>
              </div>
            </div>
            <HeroShowcase copy={copy.showcase} />
          </div>
        </section>

        <HowItWorks copy={copy.steps} />
        <OutfitOfTheDay copy={copy.outfit} />
        <FinalCta copy={copy.cta} ctaLabel={dictionary.landing.primaryCta} />
      </main>

      <footer className="grid gap-2 px-6 pt-6 text-center text-sm text-muted-foreground md:px-10">
        <p>{dictionary.landing.footer}</p>
      </footer>
      <PublicFooter locale={locale} className="px-6 pb-6 pt-3 md:px-10" />
    </div>
  )
}

function getFooterLabel(
  links: { key: string; label: string }[],
  key: string,
): string {
  return links.find((link) => link.key === key)?.label ?? key
}
