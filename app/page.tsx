import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { buttonVariants } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/language-switcher'

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/dashboard')

  const dictionary = await getDictionary()
  const locale = await getLocale()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-6 py-5 md:px-10">
        <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
          {dictionary.common.brand}
        </span>
        <nav className="flex items-center gap-3">
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

      <main className="flex flex-1 items-center justify-center px-6 md:px-10">
        <div className="mx-auto max-w-2xl py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            {dictionary.landing.eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-medium leading-tight tracking-tight text-foreground text-balance md:text-6xl">
            {dictionary.landing.headline}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground text-pretty">
            {dictionary.landing.body}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className={buttonVariants({ size: 'lg' })}>
              {dictionary.landing.primaryCta}
            </Link>
            <Link
              href="/sign-in"
              className={buttonVariants({ size: 'lg', variant: 'outline' })}
            >
              {dictionary.landing.secondaryCta}
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-sm text-muted-foreground md:px-10">
        <p>{dictionary.landing.footer}</p>
      </footer>
    </div>
  )
}
