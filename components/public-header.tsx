import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/language-switcher'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

const navCopy = {
  az: {
    home: 'Ana səhifə',
    pricing: 'Qiymətlər',
    faq: 'FAQ',
    support: 'Dəstək',
    dashboard: 'Kabinet',
  },
  en: {
    home: 'Home',
    pricing: 'Pricing',
    faq: 'FAQ',
    support: 'Support',
    dashboard: 'My wardrobe',
  },
  ru: {
    home: 'Главная',
    pricing: 'Цены',
    faq: 'FAQ',
    support: 'Поддержка',
    dashboard: 'Мой гардероб',
  },
} as const

const navItems = [
  { href: '/', key: 'home' },
  { href: '/pricing', key: 'pricing' },
  { href: '/faq', key: 'faq' },
  { href: '/support', key: 'support' },
] as const

/**
 * Top navigation for the public pages (home, pricing, FAQ, support, legal):
 * every section is one tap away at the top instead of only in the footer.
 */
export function PublicHeader({
  locale,
  dictionary,
  current,
  signedIn = false,
}: {
  locale: Locale
  dictionary: Dictionary
  current?: (typeof navItems)[number]['href']
  signedIn?: boolean
}) {
  const t = navCopy[locale]

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-10">
        <Link
          href="/"
          className="font-serif text-xl font-semibold tracking-tight text-foreground"
        >
          {dictionary.common.brand}
        </Link>
        <nav aria-label="Vestra" className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                current === item.href && 'bg-secondary text-foreground',
              )}
            >
              {t[item.key]}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher
            currentLocale={locale}
            label={dictionary.common.language}
          />
          {signedIn ? (
            <Link href="/dashboard" className={buttonVariants({ size: 'sm' })}>
              {t.dashboard}
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'hidden sm:inline-flex',
                )}
              >
                {dictionary.common.signIn}
              </Link>
              <Link href="/sign-up" className={buttonVariants({ size: 'sm' })}>
                {dictionary.common.signUp}
              </Link>
            </>
          )}
        </div>
      </div>
      <nav
        aria-label="Vestra"
        className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden"
      >
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current === item.href ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground',
              current === item.href && 'bg-secondary text-foreground',
            )}
          >
            {t[item.key]}
          </Link>
        ))}
        {!signedIn && (
          <Link
            href="/sign-in"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground sm:hidden"
          >
            {dictionary.common.signIn}
          </Link>
        )}
      </nav>
    </header>
  )
}
